import { Router } from 'express';
import { exec } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { adminAuth } from '../middleware/adminAuth.js';
import config from '../config.js';

const router = Router();
const run = promisify(exec);

// Detect the display server so we pick the right screen-control command.
// Pi OS Bookworm defaults to Wayland/labwc; older/other setups use X11.
function displayBackend() {
  if (process.env.WAYLAND_DISPLAY) return 'wayland';
  if (process.env.DISPLAY) return 'x11';
  return 'unknown';
}

async function tryRun(cmd) {
  try {
    await run(cmd, { timeout: 5000 });
    return { ok: true, cmd };
  } catch (e) {
    return { ok: false, cmd, error: e.message };
  }
}

// Turn the display off/on. We attempt the most reliable method for the detected
// backend, then fall back. The install docs explain on-Pi verification.
async function setDisplay(on) {
  const backend = displayBackend();
  const attempts = [];

  if (backend === 'wayland') {
    // labwc/wlroots: wlopm toggles output power.
    attempts.push(on ? 'wlopm --on \\*' : 'wlopm --off \\*');
    // swaymsg fallback if running sway.
    attempts.push(on ? 'swaymsg "output * power on"' : 'swaymsg "output * power off"');
  } else if (backend === 'x11') {
    attempts.push(on ? 'xset dpms force on' : 'xset dpms force off');
  }
  // Hardware fallback via vcgencmd (works on some Pi/HDMI setups).
  attempts.push(on ? 'vcgencmd display_power 1' : 'vcgencmd display_power 0');

  const results = [];
  for (const cmd of attempts) {
    const r = await tryRun(cmd);
    results.push(r);
    if (r.ok) return { on, backend, applied: cmd, results };
  }
  return { on, backend, applied: null, results };
}

router.get(
  '/info',
  asyncHandler(async (_req, res) => {
    res.json({
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptime: os.uptime(),
      loadavg: os.loadavg(),
      totalmem: os.totalmem(),
      freemem: os.freemem(),
      displayBackend: displayBackend(),
      nodeEnv: config.nodeEnv,
    });
  })
);

router.post(
  '/screen/sleep',
  adminAuth,
  asyncHandler(async (_req, res) => {
    res.json(await setDisplay(false));
  })
);

router.post(
  '/screen/wake',
  adminAuth,
  asyncHandler(async (_req, res) => {
    res.json(await setDisplay(true));
  })
);

// Reboot / shutdown — double-guarded: admin auth + explicit confirm flag.
router.post(
  '/reboot',
  adminAuth,
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== true) throw new ApiError(400, 'Confirmation required');
    res.json({ ok: true, message: 'Rebooting…' });
    setTimeout(() => {
      run('sudo systemctl reboot').catch((e) => console.error('[system] reboot failed', e.message));
    }, 500);
  })
);

router.post(
  '/shutdown',
  adminAuth,
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== true) throw new ApiError(400, 'Confirmation required');
    res.json({ ok: true, message: 'Shutting down…' });
    setTimeout(() => {
      run('sudo systemctl poweroff').catch((e) => console.error('[system] shutdown failed', e.message));
    }, 500);
  })
);

// Restart just the planner backend service (recovers a wedged app).
router.post(
  '/restart-app',
  adminAuth,
  asyncHandler(async (req, res) => {
    if (req.body?.confirm !== true) throw new ApiError(400, 'Confirmation required');
    res.json({ ok: true, message: 'Restarting app…' });
    setTimeout(() => {
      run('sudo systemctl restart wall-planner.service').catch((e) =>
        console.error('[system] restart failed', e.message)
      );
    }, 500);
  })
);

export default router;

import { Router } from 'express';
import config from '../config.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import * as g from '../services/google.js';
import { setSetting, getSetting } from '../lib/settings.js';

const router = Router();

// Status — safe to expose (no secrets). Frontend uses this to show connect UI.
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({
      configured: g.isConfigured(),
      connected: g.isConnected(),
      redirectUri: config.google.redirectUri,
      selectedCalendars: getSetting('google.selectedCalendars'),
    });
  })
);

// Begin OAuth — returns the Google consent URL for the client to open.
router.get(
  '/auth-url',
  asyncHandler(async (_req, res) => {
    if (!g.isConfigured()) {
      throw new ApiError(400, 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID/SECRET in .env');
    }
    res.json({ url: g.getAuthUrl() });
  })
);

// OAuth redirect target. Google sends ?code=...; we exchange and store tokens.
router.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const code = String(req.query.code || '');
    if (!code) throw new ApiError(400, 'Missing authorization code');
    await g.handleCallback(code);
    // Kick off an initial sync (best-effort).
    g.syncEvents().catch((e) => console.error('[google] initial sync failed', e.message));
    // Redirect back into the app settings page.
    res.redirect('/#/settings?google=connected');
  })
);

router.get(
  '/calendars',
  asyncHandler(async (_req, res) => {
    if (!g.isConnected()) throw new ApiError(400, 'Google not connected');
    res.json(await g.listCalendars());
  })
);

// Choose which calendars to display/sync.
router.put(
  '/calendars',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.calendars) ? req.body.calendars.map(String) : [];
    setSetting('google.selectedCalendars', ids);
    res.json({ selectedCalendars: ids });
  })
);

router.post(
  '/sync',
  asyncHandler(async (_req, res) => {
    if (!g.isConnected()) throw new ApiError(400, 'Google not connected');
    const result = await g.syncEvents();
    res.json(result);
  })
);

router.post(
  '/disconnect',
  asyncHandler(async (_req, res) => {
    g.disconnect();
    res.json({ connected: false });
  })
);

export default router;

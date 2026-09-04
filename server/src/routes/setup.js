import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors.js';
import { getAllSettings, setSettings, setSetting, getSetting } from '../lib/settings.js';
import { clearDemoData, seedDemoData } from '../db/seedData.js';

const router = Router();

// Returns whether first-run is complete and the current settings snapshot.
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json({
      firstRunComplete: Boolean(getSetting('general.firstRunComplete')),
      demoSeeded: Boolean(getSetting('general.demoSeeded')),
      settings: getAllSettings(),
    });
  })
);

// The wizard submits accumulated settings; we persist and mark complete.
const FinishSchema = z.object({
  settings: z.record(z.string(), z.any()).optional(),
  keepDemoData: z.boolean().optional(),
});

router.post(
  '/complete',
  asyncHandler(async (req, res) => {
    const { settings = {}, keepDemoData = false } = FinishSchema.parse(req.body);
    if (Object.keys(settings).length) setSettings(settings);
    if (!keepDemoData && getSetting('general.demoSeeded')) {
      clearDemoData();
      setSetting('general.demoSeeded', false);
    }
    setSetting('general.firstRunComplete', true);
    res.json({ firstRunComplete: true, settings: getAllSettings() });
  })
);

// Explicit demo controls (used by wizard + settings).
router.post(
  '/demo/seed',
  asyncHandler(async (_req, res) => {
    seedDemoData();
    setSetting('general.demoSeeded', true);
    res.json({ demoSeeded: true });
  })
);

router.post(
  '/demo/clear',
  asyncHandler(async (_req, res) => {
    clearDemoData();
    setSetting('general.demoSeeded', false);
    res.json({ demoSeeded: false });
  })
);

export default router;

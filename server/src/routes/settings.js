import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/errors.js';
import { getAllSettings, setSettings } from '../lib/settings.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(getAllSettings());
  })
);

// PUT accepts a partial object of key -> value pairs.
router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = z.record(z.string(), z.any()).parse(req.body);
    // Reject keys with suspicious characters to keep the store tidy.
    for (const k of Object.keys(body)) {
      if (!/^[a-zA-Z0-9_.]+$/.test(k)) {
        return res.status(400).json({ error: `Invalid setting key: ${k}` });
      }
    }
    res.json(setSettings(body));
  })
);

export default router;

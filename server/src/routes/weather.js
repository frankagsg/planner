import { Router } from 'express';
import { asyncHandler } from '../middleware/errors.js';
import { getWeather } from '../services/weather.js';
import config from '../config.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const force = String(req.query.force || '') === '1';
    try {
      const data = await getWeather({ force });
      res.json(data);
    } catch (err) {
      // Never 500 the whole UI over weather — return a structured soft error.
      res.status(200).json({
        error: err.message || 'Weather unavailable',
        available: false,
        provider: config.weather.provider,
      });
    }
  })
);

export default router;

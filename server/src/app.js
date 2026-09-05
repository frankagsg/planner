import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { notFound, errorHandler } from './middleware/errors.js';

import categories from './routes/categories.js';
import family from './routes/family.js';
import events from './routes/events.js';
import tasks from './routes/tasks.js';
import chores from './routes/chores.js';
import meals from './routes/meals.js';
import shopping from './routes/shopping.js';
import subscriptions from './routes/subscriptions.js';
import photos from './routes/photos.js';
import notes from './routes/notes.js';
import school from './routes/school.js';
import countdowns from './routes/countdowns.js';
import personal from './routes/personal.js';
import settings from './routes/settings.js';
import weather from './routes/weather.js';
import google from './routes/google.js';
import backups from './routes/backups.js';
import system from './routes/system.js';
import setup from './routes/setup.js';
import dashboard from './routes/dashboard.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');

  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / curl (no origin) and configured origins are allowed.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    })
  );

  // JSON for most routes; backups/import streams raw, and /api/photos accepts
  // larger base64 bodies via its own parser.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/backups/import')) return next();
    if (req.path.startsWith('/api/photos')) return next();
    return express.json({ limit: '2mb' })(req, res, next);
  });

  // Serve uploaded photos from the persistent store (survives frontend rebuilds).
  fs.mkdirSync(config.photosDir, { recursive: true });
  app.use('/photos', express.static(config.photosDir));

  // Health check.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString(), env: config.nodeEnv });
  });

  app.use('/api/categories', categories);
  app.use('/api/family', family);
  app.use('/api/events', events);
  app.use('/api/tasks', tasks);
  app.use('/api/chores', chores);
  app.use('/api/meals', meals);
  app.use('/api/shopping', shopping);
  app.use('/api/subscriptions', subscriptions);
  app.use('/api/photos', photos);
  app.use('/api/notes', notes);
  app.use('/api/school', school);
  app.use('/api/countdowns', countdowns);
  app.use('/api/personal', personal);
  app.use('/api/settings', settings);
  app.use('/api/weather', weather);
  app.use('/api/google', google);
  app.use('/api/backups', backups);
  app.use('/api/system', system);
  app.use('/api/setup', setup);
  app.use('/api/dashboard', dashboard);

  // Serve the built frontend in production (single-origin kiosk).
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    // SPA fallback for client-side routing (non-/api paths).
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use('/api', notFound);
  app.use(errorHandler);
  return app;
}

export default createApp;

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  createBackup,
  listBackups,
  backupPath,
  restoreBackup,
} from '../services/backup.js';
import config from '../config.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(listBackups());
  })
);

router.post(
  '/',
  asyncHandler(async (_req, res) => {
    const result = await createBackup({ label: 'manual' });
    res.status(201).json(result);
  })
);

// Download a backup file.
router.get(
  '/:name/download',
  asyncHandler(async (req, res) => {
    let p;
    try {
      p = backupPath(req.params.name);
    } catch (e) {
      throw new ApiError(404, e.message);
    }
    res.download(p);
  })
);

// Restore from an existing backup by name (admin protected).
router.post(
  '/:name/restore',
  adminAuth,
  asyncHandler(async (req, res) => {
    let p;
    try {
      p = backupPath(req.params.name);
    } catch (e) {
      throw new ApiError(404, e.message);
    }
    const result = await restoreBackup(p);
    res.json(result);
  })
);

// Restore from an uploaded archive (raw body, admin protected).
router.post(
  '/import',
  adminAuth,
  asyncHandler(async (req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    await new Promise((resolve, reject) => {
      req.on('end', resolve);
      req.on('error', reject);
    });
    const buf = Buffer.concat(chunks);
    if (!buf.length) throw new ApiError(400, 'Empty upload');
    const tmp = path.join(config.backupDir, `.upload-${Date.now()}.zip`);
    fs.writeFileSync(tmp, buf);
    try {
      const result = await restoreBackup(tmp);
      res.json(result);
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  })
);

export default router;

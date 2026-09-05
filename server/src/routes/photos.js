import { Router } from 'express';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';

const router = Router();

// Photos can be several MB as base64, so this router accepts a larger body than
// the global 2mb JSON limit (that route is excluded from the global parser).
router.use(express.json({ limit: '15mb' }));

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function ensureDir() {
  fs.mkdirSync(config.photosDir, { recursive: true });
}

// Only allow a plain filename inside photosDir — no path traversal.
function safeResolve(name) {
  const base = path.basename(String(name || ''));
  if (!base || base === '.' || base === '..') throw new ApiError(400, 'Invalid file name');
  const full = path.resolve(config.photosDir, base);
  if (path.dirname(full) !== path.resolve(config.photosDir)) {
    throw new ApiError(400, 'Invalid file name');
  }
  return full;
}

function listPhotos() {
  ensureDir();
  return fs
    .readdirSync(config.photosDir)
    .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f))
    .map((f) => {
      const st = fs.statSync(path.join(config.photosDir, f));
      return { name: f, url: `/photos/${f}`, size: st.size, mtime: st.mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

// GET /api/photos — list uploaded photos.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(listPhotos());
  })
);

// POST /api/photos — upload one photo as a base64 data URL.
// Body: { dataUrl: "data:image/png;base64,....", name?: "optional-original-name" }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { dataUrl, name } = req.body || {};
    if (typeof dataUrl !== 'string') throw new ApiError(400, 'dataUrl is required');
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
    if (!m) throw new ApiError(400, 'Malformed data URL');
    const mime = m[1].toLowerCase();
    const ext = ALLOWED[mime];
    if (!ext) throw new ApiError(415, 'Unsupported image type (use JPG, PNG, WEBP, or GIF)');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length === 0) throw new ApiError(400, 'Empty image');
    if (buf.length > 12 * 1024 * 1024) throw new ApiError(413, 'Image too large (max 12 MB)');

    ensureDir();
    // Derive a readable, collision-free filename.
    const stem =
      String(name || 'photo')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'photo';
    const filename = `${stem}-${Date.now()}.${ext}`;
    fs.writeFileSync(safeResolve(filename), buf);
    res.status(201).json({ name: filename, url: `/photos/${filename}`, size: buf.length });
  })
);

// DELETE /api/photos/:name — remove a photo.
router.delete(
  '/:name',
  asyncHandler(async (req, res) => {
    const full = safeResolve(req.params.name);
    if (!fs.existsSync(full)) throw new ApiError(404, 'Photo not found');
    fs.unlinkSync(full);
    res.status(204).end();
  })
);

export default router;

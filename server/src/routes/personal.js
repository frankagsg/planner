import { Router } from 'express';
import { z } from 'zod';
import fs from 'node:fs';
import path from 'node:path';
import db from '../db/index.js';
import config from '../config.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { isoDate, parseId } from '../lib/validate.js';

const router = Router();

const ConfigSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  partner_a: z.string().max(60).optional(),
  partner_b: z.string().max(60).optional(),
  message: z.string().max(500).optional().nullable(),
  next_date_at: isoDate.optional().nullable(),
  next_date_note: z.string().max(200).optional().nullable(),
  photo_interval: z.coerce.number().int().min(2).max(120).optional(),
});

const photosDir = path.resolve(config.repoRoot, 'client', 'public', 'photos');
const IMAGE_RE = /\.(jpe?g|png|webp|gif)$/i;

function listPhotos() {
  try {
    return fs
      .readdirSync(photosDir)
      .filter((f) => IMAGE_RE.test(f))
      .map((f) => `/photos/${f}`);
  } catch {
    return [];
  }
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const cfg = db.prepare('SELECT * FROM personal_config WHERE id=1').get();
    const events = db
      .prepare('SELECT * FROM personal_events ORDER BY at ASC')
      .all();
    res.json({ config: cfg, events, photos: listPhotos() });
  })
);

router.put(
  '/config',
  asyncHandler(async (req, res) => {
    const d = ConfigSchema.parse(req.body);
    const existing = db.prepare('SELECT * FROM personal_config WHERE id=1').get();
    const merged = {
      ...existing,
      ...d,
      enabled: (d.enabled ?? existing.enabled) ? 1 : 0,
    };
    db.prepare(
      `UPDATE personal_config SET enabled=@enabled, partner_a=@partner_a, partner_b=@partner_b,
       message=@message, next_date_at=@next_date_at, next_date_note=@next_date_note,
       photo_interval=@photo_interval, updated_at=datetime('now') WHERE id=1`
    ).run(merged);
    res.json(db.prepare('SELECT * FROM personal_config WHERE id=1').get());
  })
);

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  at: isoDate,
  note: z.string().max(500).optional().nullable(),
});

router.post(
  '/events',
  asyncHandler(async (req, res) => {
    const d = EventSchema.parse(req.body);
    const info = db
      .prepare('INSERT INTO personal_events (title, at, note) VALUES (@title,@at,@note)')
      .run({ note: null, ...d });
    res.status(201).json(db.prepare('SELECT * FROM personal_events WHERE id=?').get(info.lastInsertRowid));
  })
);

router.delete(
  '/events/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM personal_events WHERE id=?').run(id);
    res.status(204).end();
  })
);

export default router;

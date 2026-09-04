import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, isoDate, parseId } from '../lib/validate.js';

const router = Router();

const Schema = z.object({
  label: z.string().min(1).max(120),
  target: isoDate,
  color: hexColor.default('#e8a0bf'),
  icon: z.string().max(40).optional().nullable(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(db.prepare('SELECT * FROM countdowns ORDER BY target ASC').all());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = Schema.parse(req.body);
    const info = db
      .prepare(`INSERT INTO countdowns (label, target, color, icon) VALUES (@label,@target,@color,@icon)`)
      .run({ icon: null, ...d });
    res.status(201).json(db.prepare('SELECT * FROM countdowns WHERE id=?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM countdowns WHERE id=?').get(id);
    if (!existing) throw new ApiError(404, 'Countdown not found');
    const d = Schema.partial().parse(req.body);
    const merged = { ...existing, ...d };
    db.prepare(
      `UPDATE countdowns SET label=@label, target=@target, color=@color, icon=@icon,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM countdowns WHERE id=?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM countdowns WHERE id=?').run(id);
    res.status(204).end();
  })
);

export default router;

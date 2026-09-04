import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, parseId } from '../lib/validate.js';

const router = Router();

const CategorySchema = z.object({
  name: z.string().min(1).max(80),
  color: hexColor.default('#8b7bf6'),
  icon: z.string().max(40).optional().nullable(),
  kind: z.enum(['general', 'school', 'personal']).default('general'),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = db.prepare('SELECT * FROM categories ORDER BY name').all();
    res.json(rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = CategorySchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO categories (name, color, icon, kind) VALUES (@name, @color, @icon, @kind)`
      )
      .run({ icon: null, ...data });
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(row);
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const data = CategorySchema.partial().parse(req.body);
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Category not found');
    const merged = { ...existing, ...data };
    db.prepare(
      `UPDATE categories SET name=@name, color=@color, icon=@icon, kind=@kind,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

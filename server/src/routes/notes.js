import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, parseId } from '../lib/validate.js';

const router = Router();

const NoteSchema = z.object({
  title: z.string().max(200).optional().nullable(),
  body: z.string().max(20000).default(''),
  color: hexColor.default('#fff7ed'),
  pinned: z.coerce.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(
      db.prepare('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC').all()
    );
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = NoteSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO notes (title, body, color, pinned) VALUES (@title,@body,@color,@pinned)`
      )
      .run({ title: null, ...data, pinned: data.pinned ? 1 : 0 });
    res.status(201).json(db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Note not found');
    const data = NoteSchema.partial().parse(req.body);
    const merged = {
      ...existing,
      ...data,
      pinned: (data.pinned ?? existing.pinned) ? 1 : 0,
    };
    db.prepare(
      `UPDATE notes SET title=@title, body=@body, color=@color, pinned=@pinned,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM notes WHERE id = ?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

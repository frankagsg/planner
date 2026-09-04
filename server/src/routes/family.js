import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, parseId } from '../lib/validate.js';

const router = Router();

const MemberSchema = z.object({
  name: z.string().min(1).max(60),
  color: hexColor.default('#e382a8'),
  emoji: z.string().max(8).optional().nullable(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
    .optional()
    .nullable(),
  role: z.enum(['adult', 'child']).default('adult'),
  sort_order: z.coerce.number().int().optional(),
  active: z.coerce.boolean().optional(),
});

// GET /api/family — all members (active first by sort order). ?activeOnly=1 to filter.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const activeOnly = ['1', 'true'].includes(String(req.query.activeOnly || ''));
    let sql = 'SELECT * FROM family_members';
    if (activeOnly) sql += ' WHERE active = 1';
    sql += ' ORDER BY sort_order ASC, id ASC';
    res.json(db.prepare(sql).all());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = MemberSchema.parse(req.body);
    // Default sort_order to the next slot when not provided.
    const nextOrder =
      d.sort_order ??
      (db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM family_members').get().n);
    const info = db
      .prepare(
        `INSERT INTO family_members (name, color, emoji, birthday, role, sort_order, active)
         VALUES (@name,@color,@emoji,@birthday,@role,@sort_order,@active)`
      )
      .run({
        emoji: null,
        birthday: null,
        ...d,
        sort_order: nextOrder,
        active: d.active === undefined ? 1 : d.active ? 1 : 0,
      });
    res
      .status(201)
      .json(db.prepare('SELECT * FROM family_members WHERE id = ?').get(info.lastInsertRowid));
  })
);

// Reorder: accepts { order: [id, id, ...] } and rewrites sort_order.
// Declared before '/:id' so it isn't captured as an id param.
router.put(
  '/reorder',
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.order) ? req.body.order.map(Number) : [];
    const stmt = db.prepare(
      `UPDATE family_members SET sort_order=?, updated_at=datetime('now') WHERE id=?`
    );
    const tx = db.transaction(() => {
      ids.forEach((id, i) => stmt.run(i, id));
    });
    tx();
    res.json(db.prepare('SELECT * FROM family_members ORDER BY sort_order ASC, id ASC').all());
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM family_members WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Member not found');
    const d = MemberSchema.partial().parse(req.body);
    const merged = {
      ...existing,
      ...d,
      active: (d.active ?? existing.active) ? 1 : 0,
    };
    db.prepare(
      `UPDATE family_members SET name=@name, color=@color, emoji=@emoji, birthday=@birthday,
       role=@role, sort_order=@sort_order, active=@active, updated_at=datetime('now')
       WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM family_members WHERE id = ?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    // ON DELETE SET NULL on referencing rows keeps their items as "shared".
    db.prepare('DELETE FROM family_members WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

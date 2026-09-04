import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { isoDate, parseId } from '../lib/validate.js';

const router = Router();

const TaskSchema = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(4000).optional().nullable(),
  due: isoDate.optional().nullable(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  completed: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

// GET /api/tasks?filter=today|upcoming|completed|all
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = String(req.query.filter || 'all');
    let sql = 'SELECT * FROM tasks';
    const params = {};
    if (filter === 'completed') {
      sql += ' WHERE completed = 1';
    } else if (filter === 'today') {
      sql += " WHERE completed = 0 AND due IS NOT NULL AND date(due) = date('now','localtime')";
    } else if (filter === 'upcoming') {
      sql += " WHERE completed = 0 AND (due IS NULL OR date(due) >= date('now','localtime'))";
    } else if (filter === 'active') {
      sql += ' WHERE completed = 0';
    }
    sql += ' ORDER BY completed ASC, (due IS NULL) ASC, due ASC, sort_order ASC, id DESC';
    res.json(db.prepare(sql).all(params));
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = TaskSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO tasks (title, notes, due, priority, category_id, completed, completed_at, sort_order)
         VALUES (@title,@notes,@due,@priority,@category_id,@completed,@completed_at,@sort_order)`
      )
      .run({
        notes: null,
        due: null,
        category_id: null,
        sort_order: 0,
        ...data,
        completed: data.completed ? 1 : 0,
        completed_at: data.completed ? new Date().toISOString() : null,
      });
    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Task not found');
    const data = TaskSchema.partial().parse(req.body);
    const willComplete = data.completed ?? Boolean(existing.completed);
    const merged = {
      ...existing,
      ...data,
      completed: willComplete ? 1 : 0,
      completed_at: willComplete
        ? existing.completed_at || new Date().toISOString()
        : null,
    };
    db.prepare(
      `UPDATE tasks SET title=@title, notes=@notes, due=@due, priority=@priority,
       category_id=@category_id, completed=@completed, completed_at=@completed_at,
       sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  })
);

// Convenience toggle for touch UI.
router.post(
  '/:id/toggle',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Task not found');
    const completed = existing.completed ? 0 : 1;
    db.prepare(
      `UPDATE tasks SET completed=?, completed_at=?, updated_at=datetime('now') WHERE id=?`
    ).run(completed, completed ? new Date().toISOString() : null, id);
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

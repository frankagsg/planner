import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, isoDate, parseId } from '../lib/validate.js';

const router = Router();

/* ------------------------------- classes -------------------------------- */
const ClassSchema = z.object({
  name: z.string().min(1).max(120),
  code: z.string().max(40).optional().nullable(),
  instructor: z.string().max(120).optional().nullable(),
  color: hexColor.default('#7cc4a4'),
  term: z.string().max(60).optional().nullable(),
  schedule: z.string().max(200).optional().nullable(),
  location: z.string().max(120).optional().nullable(),
  archived: z.coerce.boolean().optional(),
});

router.get(
  '/classes',
  asyncHandler(async (_req, res) => {
    res.json(db.prepare('SELECT * FROM school_classes ORDER BY archived, name').all());
  })
);

router.post(
  '/classes',
  asyncHandler(async (req, res) => {
    const d = ClassSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO school_classes (name, code, instructor, color, term, schedule, location, archived)
         VALUES (@name,@code,@instructor,@color,@term,@schedule,@location,@archived)`
      )
      .run({
        code: null, instructor: null, term: null, schedule: null, location: null,
        ...d, archived: d.archived ? 1 : 0,
      });
    res.status(201).json(db.prepare('SELECT * FROM school_classes WHERE id=?').get(info.lastInsertRowid));
  })
);

router.put(
  '/classes/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM school_classes WHERE id=?').get(id);
    if (!existing) throw new ApiError(404, 'Class not found');
    const d = ClassSchema.partial().parse(req.body);
    const merged = { ...existing, ...d, archived: (d.archived ?? existing.archived) ? 1 : 0 };
    db.prepare(
      `UPDATE school_classes SET name=@name, code=@code, instructor=@instructor, color=@color,
       term=@term, schedule=@schedule, location=@location, archived=@archived,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM school_classes WHERE id=?').get(id));
  })
);

router.delete(
  '/classes/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM school_classes WHERE id=?').run(id);
    res.status(204).end();
  })
);

/* -------------------------------- items --------------------------------- */
const ItemSchema = z.object({
  class_id: z.coerce.number().int().positive().optional().nullable(),
  title: z.string().min(1).max(200),
  kind: z.enum(['assignment', 'exam', 'clinical', 'study', 'reading', 'project']).default('assignment'),
  due: isoDate.optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  completed: z.coerce.boolean().optional(),
});

// GET /api/school/items?filter=overdue|today|tomorrow|week|all
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const filter = String(req.query.filter || 'all');
    let where = '';
    if (filter === 'overdue') {
      where = " WHERE completed=0 AND due IS NOT NULL AND datetime(due) < datetime('now','localtime')";
    } else if (filter === 'today') {
      where = " WHERE completed=0 AND due IS NOT NULL AND date(due)=date('now','localtime')";
    } else if (filter === 'tomorrow') {
      where = " WHERE completed=0 AND due IS NOT NULL AND date(due)=date('now','localtime','+1 day')";
    } else if (filter === 'week') {
      where = " WHERE completed=0 AND due IS NOT NULL AND date(due) BETWEEN date('now','localtime') AND date('now','localtime','+7 day')";
    } else if (filter === 'active') {
      where = ' WHERE completed=0';
    }
    const rows = db
      .prepare(
        `SELECT si.*, sc.name AS class_name, sc.color AS class_color
         FROM school_items si LEFT JOIN school_classes sc ON sc.id = si.class_id
         ${where} ORDER BY (si.due IS NULL) ASC, si.due ASC, si.id DESC`
      )
      .all();
    res.json(rows);
  })
);

// Progress summary: counts by state for a friendly, non-stressful indicator.
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const q = (sql) => db.prepare(sql).get().n;
    res.json({
      remaining: q('SELECT COUNT(*) n FROM school_items WHERE completed=0'),
      completed: q('SELECT COUNT(*) n FROM school_items WHERE completed=1'),
      dueToday: q("SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND date(due)=date('now','localtime')"),
      dueTomorrow: q("SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND date(due)=date('now','localtime','+1 day')"),
      dueThisWeek: q("SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND date(due) BETWEEN date('now','localtime') AND date('now','localtime','+7 day')"),
      overdue: q("SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND datetime(due) < datetime('now','localtime')"),
    });
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const d = ItemSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO school_items (class_id, title, kind, due, notes, completed, completed_at)
         VALUES (@class_id,@title,@kind,@due,@notes,@completed,@completed_at)`
      )
      .run({
        class_id: null, due: null, notes: null,
        ...d,
        completed: d.completed ? 1 : 0,
        completed_at: d.completed ? new Date().toISOString() : null,
      });
    res.status(201).json(db.prepare('SELECT * FROM school_items WHERE id=?').get(info.lastInsertRowid));
  })
);

router.put(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM school_items WHERE id=?').get(id);
    if (!existing) throw new ApiError(404, 'Item not found');
    const d = ItemSchema.partial().parse(req.body);
    const willComplete = d.completed ?? Boolean(existing.completed);
    const merged = {
      ...existing, ...d,
      completed: willComplete ? 1 : 0,
      completed_at: willComplete ? existing.completed_at || new Date().toISOString() : null,
    };
    db.prepare(
      `UPDATE school_items SET class_id=@class_id, title=@title, kind=@kind, due=@due,
       notes=@notes, completed=@completed, completed_at=@completed_at,
       updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM school_items WHERE id=?').get(id));
  })
);

router.post(
  '/items/:id/toggle',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM school_items WHERE id=?').get(id);
    if (!existing) throw new ApiError(404, 'Item not found');
    const completed = existing.completed ? 0 : 1;
    db.prepare(
      `UPDATE school_items SET completed=?, completed_at=?, updated_at=datetime('now') WHERE id=?`
    ).run(completed, completed ? new Date().toISOString() : null, id);
    res.json(db.prepare('SELECT * FROM school_items WHERE id=?').get(id));
  })
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM school_items WHERE id=?').run(id);
    res.status(204).end();
  })
);

export default router;

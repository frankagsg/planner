import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { parseId } from '../lib/validate.js';
import { getSetting } from '../lib/settings.js';
import { choreAppliesOn, localDate, weekDates } from '../lib/chores.js';

const router = Router();

const ChoreSchema = z.object({
  title: z.string().min(1).max(200),
  member_id: z.coerce.number().int().positive().optional().nullable(),
  points: z.coerce.number().int().min(0).max(1000).default(1),
  recurrence: z.enum(['none', 'daily', 'weekly', 'specific-days']).default('none'),
  days_of_week: z.coerce.number().int().min(0).max(127).default(0),
  active: z.coerce.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  sort_order: z.coerce.number().int().optional(),
});

function choreRow(id) {
  return db.prepare('SELECT * FROM chores WHERE id = ?').get(id);
}

// Attach today's completion (if any) to a chore for a given date.
function withCompletion(chore, dateStr) {
  const comp = db
    .prepare('SELECT * FROM chore_completions WHERE chore_id = ? AND completed_on = ?')
    .get(chore.id, dateStr);
  return { ...chore, done: Boolean(comp), completion: comp || null };
}

// GET /api/chores — raw list (for management). ?activeOnly=1 optional.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const activeOnly = ['1', 'true'].includes(String(req.query.activeOnly || ''));
    let sql = 'SELECT * FROM chores';
    if (activeOnly) sql += ' WHERE active = 1';
    sql += ' ORDER BY sort_order ASC, id ASC';
    res.json(db.prepare(sql).all());
  })
);

// GET /api/chores/today — chores that apply today with done state.
router.get(
  '/today',
  asyncHandler(async (req, res) => {
    const date = String(req.query.date || localDate());
    const chores = db
      .prepare('SELECT * FROM chores WHERE active = 1 ORDER BY sort_order ASC, id ASC')
      .all()
      .filter((c) => choreAppliesOn(c, date));
    res.json({ date, chores: chores.map((c) => withCompletion(c, date)) });
  })
);

// GET /api/chores/week — this week's grid: for each applicable day, done state.
router.get(
  '/week',
  asyncHandler(async (req, res) => {
    const weekStart = Number(getSetting('calendar.weekStartsOn')) || 0;
    const ref = req.query.ref ? new Date(String(req.query.ref)) : new Date();
    const dates = weekDates(ref, weekStart);
    const chores = db
      .prepare('SELECT * FROM chores WHERE active = 1 ORDER BY sort_order ASC, id ASC')
      .all();
    const compStmt = db.prepare(
      'SELECT completed_on FROM chore_completions WHERE chore_id = ? AND completed_on IN (' +
        dates.map(() => '?').join(',') +
        ')'
    );
    const rows = chores.map((c) => {
      const doneOn = new Set(compStmt.all(c.id, ...dates).map((r) => r.completed_on));
      const days = dates.map((d) => ({
        date: d,
        applies: choreAppliesOn(c, d),
        done: doneOn.has(d),
      }));
      return { ...c, days };
    });
    res.json({ dates, chores: rows });
  })
);

// GET /api/chores/leaderboard — points per member: this week + all time.
router.get(
  '/leaderboard',
  asyncHandler(async (_req, res) => {
    const weekStart = Number(getSetting('calendar.weekStartsOn')) || 0;
    const dates = weekDates(new Date(), weekStart);
    const members = db
      .prepare('SELECT * FROM family_members WHERE active = 1 ORDER BY sort_order ASC, id ASC')
      .all();

    const weekStmt = db.prepare(
      `SELECT COALESCE(SUM(points_awarded),0) AS pts, COUNT(*) AS n
       FROM chore_completions WHERE member_id = ? AND completed_on IN (` +
        dates.map(() => '?').join(',') +
        ')'
    );
    const allStmt = db.prepare(
      `SELECT COALESCE(SUM(points_awarded),0) AS pts, COUNT(*) AS n
       FROM chore_completions WHERE member_id = ?`
    );

    const board = members.map((m) => {
      const w = weekStmt.get(m.id, ...dates);
      const a = allStmt.get(m.id);
      return {
        member: m,
        weekPoints: w.pts,
        weekCount: w.n,
        allTimePoints: a.pts,
        allTimeCount: a.n,
      };
    });
    // Unassigned/shared completions (member_id NULL) for completeness.
    const sharedWeek = db
      .prepare(
        `SELECT COALESCE(SUM(points_awarded),0) AS pts FROM chore_completions
         WHERE member_id IS NULL AND completed_on IN (` +
          dates.map(() => '?').join(',') +
          ')'
      )
      .get(...dates).pts;

    res.json({ weekDates: dates, board, sharedWeekPoints: sharedWeek });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = ChoreSchema.parse(req.body);
    const nextOrder =
      d.sort_order ??
      db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM chores').get().n;
    const info = db
      .prepare(
        `INSERT INTO chores (title, member_id, points, recurrence, days_of_week, active, notes, sort_order)
         VALUES (@title,@member_id,@points,@recurrence,@days_of_week,@active,@notes,@sort_order)`
      )
      .run({
        member_id: null,
        notes: null,
        ...d,
        sort_order: nextOrder,
        active: d.active === undefined ? 1 : d.active ? 1 : 0,
      });
    res.status(201).json(choreRow(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = choreRow(id);
    if (!existing) throw new ApiError(404, 'Chore not found');
    const d = ChoreSchema.partial().parse(req.body);
    const merged = { ...existing, ...d, active: (d.active ?? existing.active) ? 1 : 0 };
    db.prepare(
      `UPDATE chores SET title=@title, member_id=@member_id, points=@points,
       recurrence=@recurrence, days_of_week=@days_of_week, active=@active,
       notes=@notes, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(choreRow(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM chores WHERE id = ?').run(id); // completions cascade
    res.status(204).end();
  })
);

// POST /api/chores/:id/complete — record a completion for a day (idempotent).
// Body: { date?, member_id? }. member defaults to the chore's assignee.
router.post(
  '/:id/complete',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const chore = choreRow(id);
    if (!chore) throw new ApiError(404, 'Chore not found');
    const date = String(req.body?.date || localDate());
    const memberId =
      req.body?.member_id !== undefined ? req.body.member_id : chore.member_id;

    // Idempotent: unique (chore_id, completed_on). If already done, return it.
    const existing = db
      .prepare('SELECT * FROM chore_completions WHERE chore_id = ? AND completed_on = ?')
      .get(id, date);
    if (existing) {
      return res.json({ chore: withCompletion(chore, date), completion: existing });
    }
    const info = db
      .prepare(
        `INSERT INTO chore_completions (chore_id, member_id, completed_at, completed_on, points_awarded)
         VALUES (?, ?, datetime('now'), ?, ?)`
      )
      .run(id, memberId ?? null, date, chore.points);
    const completion = db
      .prepare('SELECT * FROM chore_completions WHERE id = ?')
      .get(info.lastInsertRowid);
    res.status(201).json({ chore: withCompletion(chore, date), completion });
  })
);

// POST /api/chores/:id/undo — remove a completion for a day.
router.post(
  '/:id/undo',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const chore = choreRow(id);
    if (!chore) throw new ApiError(404, 'Chore not found');
    const date = String(req.body?.date || localDate());
    db.prepare('DELETE FROM chore_completions WHERE chore_id = ? AND completed_on = ?').run(
      id,
      date
    );
    res.json({ chore: withCompletion(chore, date) });
  })
);

export default router;

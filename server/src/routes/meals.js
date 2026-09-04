import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { parseId } from '../lib/validate.js';
import { getSetting } from '../lib/settings.js';
import { weekDates } from '../lib/chores.js';
import { defaultListId, addItems } from './shopping.js';

const router = Router();

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];

const MealSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD'),
  slot: z.enum(SLOTS).default('dinner'),
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  recipe_url: z.string().url().max(2000).optional().nullable().or(z.literal('')),
  member_id: z.coerce.number().int().positive().optional().nullable(),
});

function mealRow(id) {
  return db.prepare('SELECT * FROM meals WHERE id = ?').get(id);
}

// GET /api/meals?from=YYYY-MM-DD&to=YYYY-MM-DD  (range) — flat list.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM meals';
    const clauses = [];
    const params = {};
    if (from) {
      clauses.push('date >= @from');
      params.from = String(from);
    }
    if (to) {
      clauses.push('date <= @to');
      params.to = String(to);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += " ORDER BY date ASC, CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END, id ASC";
    res.json(db.prepare(sql).all(params));
  })
);

// GET /api/meals/week?ref=YYYY-MM-DD — 7-day grid grouped by date+slot.
router.get(
  '/week',
  asyncHandler(async (req, res) => {
    const weekStart = Number(getSetting('calendar.weekStartsOn')) || 0;
    const ref = req.query.ref ? new Date(String(req.query.ref) + 'T00:00:00') : new Date();
    const dates = weekDates(ref, weekStart);
    const rows = db
      .prepare('SELECT * FROM meals WHERE date IN (' + dates.map(() => '?').join(',') + ')')
      .all(...dates);
    res.json({ dates, slots: SLOTS, meals: rows });
  })
);

// POST /api/meals/add-ingredients — push a list of ingredient lines onto a
// shopping list (defaults to the first/Groceries list). Body: { items: [".."], list_id? }
router.post(
  '/add-ingredients',
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) throw new ApiError(400, 'No ingredients provided');
    const listId = req.body?.list_id ? Number(req.body.list_id) : defaultListId();
    const added = addItems(listId, items);
    res.status(201).json({ listId, added });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = MealSchema.parse(req.body);
    const info = db
      .prepare(
        `INSERT INTO meals (date, slot, title, notes, recipe_url, member_id)
         VALUES (@date,@slot,@title,@notes,@recipe_url,@member_id)`
      )
      .run({
        notes: null,
        recipe_url: null,
        member_id: null,
        ...d,
        recipe_url: d.recipe_url ? d.recipe_url : null,
      });
    res.status(201).json(mealRow(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = mealRow(id);
    if (!existing) throw new ApiError(404, 'Meal not found');
    const d = MealSchema.partial().parse(req.body);
    const merged = {
      ...existing,
      ...d,
      recipe_url: d.recipe_url !== undefined ? d.recipe_url || null : existing.recipe_url,
    };
    db.prepare(
      `UPDATE meals SET date=@date, slot=@slot, title=@title, notes=@notes,
       recipe_url=@recipe_url, member_id=@member_id, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(mealRow(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM meals WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

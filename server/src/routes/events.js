import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, isoDate, parseId } from '../lib/validate.js';

const router = Router();

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  start: isoDate,
  end: isoDate,
  all_day: z.coerce.boolean().default(false),
  category_id: z.coerce.number().int().positive().optional().nullable(),
  color: hexColor.optional().nullable(),
  rrule: z.string().max(500).optional().nullable(),
});

function toRow(data) {
  return {
    title: data.title,
    description: data.description ?? null,
    location: data.location ?? null,
    start: data.start,
    end: data.end,
    all_day: data.all_day ? 1 : 0,
    category_id: data.category_id ?? null,
    color: data.color ?? null,
    rrule: data.rrule ?? null,
  };
}

// GET /api/events?from=ISO&to=ISO  (range optional; returns local events)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { from, to, source } = req.query;
    let sql = 'SELECT * FROM events';
    const clauses = [];
    const params = {};
    if (from) {
      clauses.push('end >= @from');
      params.from = String(from);
    }
    if (to) {
      clauses.push('start <= @to');
      params.to = String(to);
    }
    if (source) {
      clauses.push('source = @source');
      params.source = String(source);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY start';
    res.json(db.prepare(sql).all(params));
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'Event not found');
    res.json(row);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = EventSchema.parse(req.body);
    if (Date.parse(data.end) < Date.parse(data.start)) {
      throw new ApiError(400, 'Event end must be on or after start');
    }
    const info = db
      .prepare(
        `INSERT INTO events (title, description, location, start, "end", all_day, category_id, color, rrule)
         VALUES (@title,@description,@location,@start,@end,@all_day,@category_id,@color,@rrule)`
      )
      .run(toRow(data));
    res.status(201).json(db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Event not found');
    if (existing.source === 'google') {
      // Local edits to synced Google events are allowed but flagged; the
      // Google service reconciles on next push. We still update locally.
    }
    const data = EventSchema.partial().parse(req.body);
    const merged = { ...existing, ...data, all_day: (data.all_day ?? existing.all_day) ? 1 : 0 };
    db.prepare(
      `UPDATE events SET title=@title, description=@description, location=@location,
       start=@start, "end"=@end, all_day=@all_day, category_id=@category_id,
       color=@color, rrule=@rrule, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

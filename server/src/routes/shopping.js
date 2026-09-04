import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { parseId } from '../lib/validate.js';

const router = Router();

// ---- helpers shared with the meal planner "add ingredients" action ----
export function defaultListId() {
  const row = db.prepare('SELECT id FROM shopping_lists ORDER BY sort_order ASC, id ASC LIMIT 1').get();
  if (row) return row.id;
  // Self-heal: recreate a default list if somehow none exist.
  return db.prepare("INSERT INTO shopping_lists (name, sort_order) VALUES ('Groceries', 0)").run()
    .lastInsertRowid;
}

export function addItems(listId, texts) {
  const stmt = db.prepare(
    `INSERT INTO shopping_items (list_id, text, sort_order)
     VALUES (?, ?, (SELECT COALESCE(MAX(sort_order),-1)+1 FROM shopping_items WHERE list_id = ?))`
  );
  const added = [];
  const tx = db.transaction(() => {
    for (const t of texts) {
      const text = String(t).trim();
      if (!text) continue;
      const info = stmt.run(listId, text, listId);
      added.push(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(info.lastInsertRowid));
    }
  });
  tx();
  return added;
}

// ============================ Lists ============================
const ListSchema = z.object({
  name: z.string().min(1).max(80),
  sort_order: z.coerce.number().int().optional(),
});

// GET /api/shopping/lists — lists with item counts.
router.get(
  '/lists',
  asyncHandler(async (_req, res) => {
    const lists = db.prepare('SELECT * FROM shopping_lists ORDER BY sort_order ASC, id ASC').all();
    const counts = db
      .prepare(
        `SELECT list_id, COUNT(*) AS total, SUM(checked) AS checked
         FROM shopping_items GROUP BY list_id`
      )
      .all();
    const byList = Object.fromEntries(counts.map((c) => [c.list_id, c]));
    res.json(
      lists.map((l) => ({
        ...l,
        total: byList[l.id]?.total || 0,
        checked: byList[l.id]?.checked || 0,
      }))
    );
  })
);

router.post(
  '/lists',
  asyncHandler(async (req, res) => {
    const d = ListSchema.parse(req.body);
    const nextOrder =
      d.sort_order ??
      db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM shopping_lists').get().n;
    const info = db
      .prepare('INSERT INTO shopping_lists (name, sort_order) VALUES (?, ?)')
      .run(d.name, nextOrder);
    res.status(201).json(db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/lists/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'List not found');
    const d = ListSchema.partial().parse(req.body);
    const merged = { ...existing, ...d };
    db.prepare(
      `UPDATE shopping_lists SET name=@name, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id));
  })
);

router.delete(
  '/lists/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(id); // items cascade
    res.status(204).end();
  })
);

// Clear checked items in a list.
router.post(
  '/lists/:id/clear-checked',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const info = db.prepare('DELETE FROM shopping_items WHERE list_id = ? AND checked = 1').run(id);
    res.json({ cleared: info.changes });
  })
);

// ============================ Items ============================
const ItemSchema = z.object({
  list_id: z.coerce.number().int().positive(),
  text: z.string().min(1).max(200),
  qty: z.string().max(60).optional().nullable(),
  member_id: z.coerce.number().int().positive().optional().nullable(),
  checked: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
});

// GET /api/shopping/items?list_id=1
router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const listId = req.query.list_id ? Number(req.query.list_id) : null;
    let sql = 'SELECT * FROM shopping_items';
    const params = {};
    if (listId) {
      sql += ' WHERE list_id = @list_id';
      params.list_id = listId;
    }
    sql += ' ORDER BY checked ASC, sort_order ASC, id ASC';
    res.json(db.prepare(sql).all(params));
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const d = ItemSchema.parse(req.body);
    const list = db.prepare('SELECT id FROM shopping_lists WHERE id = ?').get(d.list_id);
    if (!list) throw new ApiError(400, 'Unknown list');
    const nextOrder =
      d.sort_order ??
      db
        .prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM shopping_items WHERE list_id = ?')
        .get(d.list_id).n;
    const info = db
      .prepare(
        `INSERT INTO shopping_items (list_id, text, qty, member_id, checked, sort_order)
         VALUES (@list_id,@text,@qty,@member_id,@checked,@sort_order)`
      )
      .run({
        qty: null,
        member_id: null,
        ...d,
        sort_order: nextOrder,
        checked: d.checked ? 1 : 0,
      });
    res.status(201).json(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(info.lastInsertRowid));
  })
);

router.put(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Item not found');
    const d = ItemSchema.partial().parse(req.body);
    const merged = { ...existing, ...d, checked: (d.checked ?? existing.checked) ? 1 : 0 };
    db.prepare(
      `UPDATE shopping_items SET list_id=@list_id, text=@text, qty=@qty, member_id=@member_id,
       checked=@checked, sort_order=@sort_order, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id));
  })
);

// Convenience toggle for the big touch checkboxes.
router.post(
  '/items/:id/toggle',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id);
    if (!existing) throw new ApiError(404, 'Item not found');
    const checked = existing.checked ? 0 : 1;
    db.prepare(
      `UPDATE shopping_items SET checked=?, updated_at=datetime('now') WHERE id=?`
    ).run(checked, id);
    res.json(db.prepare('SELECT * FROM shopping_items WHERE id = ?').get(id));
  })
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    db.prepare('DELETE FROM shopping_items WHERE id = ?').run(id);
    res.status(204).end();
  })
);

export default router;

import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.js';
import { asyncHandler, ApiError } from '../middleware/errors.js';
import { hexColor, parseId } from '../lib/validate.js';
import {
  validateUrl,
  syncSubscription,
  syncAllSubscriptions,
  purgeSubscriptionEvents,
} from '../services/subscriptions.js';

const router = Router();

const SubSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().min(1).max(2000),
  color: hexColor.default('#6c9ae8'),
  member_id: z.coerce.number().int().positive().optional().nullable(),
  enabled: z.coerce.boolean().optional(),
});

function subRow(id) {
  return db.prepare('SELECT * FROM calendar_subscriptions WHERE id = ?').get(id);
}

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(db.prepare('SELECT * FROM calendar_subscriptions ORDER BY id ASC').all());
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const d = SubSchema.parse(req.body);
    const v = validateUrl(d.url);
    if (!v.ok) throw new ApiError(400, v.error);
    const info = db
      .prepare(
        `INSERT INTO calendar_subscriptions (name, url, color, member_id, enabled)
         VALUES (@name,@url,@color,@member_id,@enabled)`
      )
      .run({
        member_id: null,
        ...d,
        enabled: d.enabled === undefined ? 1 : d.enabled ? 1 : 0,
      });
    const sub = subRow(info.lastInsertRowid);
    // Kick an initial sync (best-effort; result surfaced via last_error).
    const result = await syncSubscription(sub);
    res.status(201).json({ subscription: subRow(sub.id), sync: result });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = subRow(id);
    if (!existing) throw new ApiError(404, 'Subscription not found');
    const d = SubSchema.partial().parse(req.body);
    if (d.url) {
      const v = validateUrl(d.url);
      if (!v.ok) throw new ApiError(400, v.error);
    }
    const merged = { ...existing, ...d, enabled: (d.enabled ?? existing.enabled) ? 1 : 0 };
    db.prepare(
      `UPDATE calendar_subscriptions SET name=@name, url=@url, color=@color,
       member_id=@member_id, enabled=@enabled, updated_at=datetime('now') WHERE id=@id`
    ).run({ ...merged, id });
    res.json(subRow(id));
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    purgeSubscriptionEvents(id);
    db.prepare('DELETE FROM calendar_subscriptions WHERE id = ?').run(id);
    res.status(204).end();
  })
);

// Sync one subscription now.
router.post(
  '/:id/sync',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const sub = subRow(id);
    if (!sub) throw new ApiError(404, 'Subscription not found');
    const result = await syncSubscription(sub);
    res.json({ subscription: subRow(id), sync: result });
  })
);

// Sync all enabled subscriptions now.
router.post(
  '/sync',
  asyncHandler(async (_req, res) => {
    res.json(await syncAllSubscriptions());
  })
);

export default router;

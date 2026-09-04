import { Router } from 'express';
import db from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';

const router = Router();

// One aggregate call the Home dashboard uses so it renders fast and works
// offline from a single cached payload.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const todayEvents = db
      .prepare(
        `SELECT * FROM events
         WHERE date(start) <= date('now','localtime') AND date("end") >= date('now','localtime')
            OR date(start) = date('now','localtime')
         ORDER BY start LIMIT 20`
      )
      .all();

    const upcomingEvents = db
      .prepare(
        `SELECT * FROM events WHERE datetime(start) >= datetime('now','localtime')
         ORDER BY start LIMIT 8`
      )
      .all();

    const tasksToday = db
      .prepare(
        `SELECT * FROM tasks WHERE completed=0 AND due IS NOT NULL
         AND date(due)=date('now','localtime') ORDER BY priority DESC, due`
      )
      .all();

    const tasksOpen = db.prepare('SELECT COUNT(*) n FROM tasks WHERE completed=0').get().n;

    const schoolSummary = {
      remaining: db.prepare('SELECT COUNT(*) n FROM school_items WHERE completed=0').get().n,
      dueToday: db
        .prepare(
          "SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND date(due)=date('now','localtime')"
        )
        .get().n,
      overdue: db
        .prepare(
          "SELECT COUNT(*) n FROM school_items WHERE completed=0 AND due IS NOT NULL AND datetime(due) < datetime('now','localtime')"
        )
        .get().n,
    };

    const pinnedNotes = db
      .prepare('SELECT * FROM notes WHERE pinned=1 ORDER BY updated_at DESC LIMIT 4')
      .all();

    const countdowns = db
      .prepare("SELECT * FROM countdowns WHERE datetime(target) >= datetime('now') ORDER BY target LIMIT 4")
      .all();

    const personal = db.prepare('SELECT * FROM personal_config WHERE id=1').get();

    res.json({
      todayEvents,
      upcomingEvents,
      tasksToday,
      tasksOpen,
      schoolSummary,
      pinnedNotes,
      countdowns,
      personal,
      generatedAt: new Date().toISOString(),
    });
  })
);

export default router;

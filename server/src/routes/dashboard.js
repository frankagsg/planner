import { Router } from 'express';
import db from '../db/index.js';
import { asyncHandler } from '../middleware/errors.js';
import { choreAppliesOn, localDate } from '../lib/chores.js';

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

    // Family members (active) for the avatar row / quick view.
    const familyMembers = db
      .prepare('SELECT * FROM family_members WHERE active=1 ORDER BY sort_order ASC, id ASC')
      .all();

    // Today's chores with done state (filtered by recurrence in JS).
    const today = localDate();
    const choresToday = db
      .prepare('SELECT * FROM chores WHERE active=1 ORDER BY sort_order ASC, id ASC')
      .all()
      .filter((c) => choreAppliesOn(c, today))
      .map((c) => {
        const done = db
          .prepare(
            'SELECT 1 FROM chore_completions WHERE chore_id=? AND completed_on=?'
          )
          .get(c.id, today);
        return { ...c, done: Boolean(done) };
      });
    const choresRemaining = choresToday.filter((c) => !c.done).length;

    // Today's meals.
    const mealsToday = db
      .prepare(
        "SELECT * FROM meals WHERE date=? ORDER BY CASE slot WHEN 'breakfast' THEN 0 WHEN 'lunch' THEN 1 WHEN 'dinner' THEN 2 ELSE 3 END, id"
      )
      .all(today);

    // Grocery/shopping unchecked count across all lists.
    const groceryOpen = db
      .prepare('SELECT COUNT(*) n FROM shopping_items WHERE checked=0')
      .get().n;
    const groceryLists = db.prepare('SELECT COUNT(*) n FROM shopping_lists').get().n;

    res.json({
      todayEvents,
      upcomingEvents,
      tasksToday,
      tasksOpen,
      schoolSummary,
      pinnedNotes,
      countdowns,
      personal,
      familyMembers,
      choresToday,
      choresRemaining,
      mealsToday,
      groceryOpen,
      groceryLists,
      generatedAt: new Date().toISOString(),
    });
  })
);

export default router;

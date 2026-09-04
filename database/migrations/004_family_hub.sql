-- Migration 004: family hub
-- Adds family member profiles (the backbone), chore chart + points, meal
-- planner, shopping/grocery lists, and ICS calendar subscriptions.
--
-- Additive only: existing tables gain a nullable member_id (NULL = shared /
-- unassigned) so every current row keeps working untouched.

-- ---------------------------------------------------------------------------
-- Family members — the backbone the rest of the hub color-codes against.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_members (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#e382a8', -- hex; validated at API layer
  emoji        TEXT,                             -- avatar emoji, e.g. 🦊 (falls back to initial)
  birthday     TEXT,                             -- ISO date (YYYY-MM-DD), optional
  role         TEXT NOT NULL DEFAULT 'adult',    -- adult | child
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_family_members_sort ON family_members(sort_order);

-- ---------------------------------------------------------------------------
-- Owner/assignee on existing tables. Nullable => shared; existing rows migrate
-- to NULL automatically. ON DELETE SET NULL so removing a member never deletes
-- their events/tasks — they just become shared again.
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL;
ALTER TABLE tasks  ADD COLUMN member_id INTEGER REFERENCES family_members(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_member ON events(member_id);
CREATE INDEX IF NOT EXISTS idx_tasks_member  ON tasks(member_id);

-- ---------------------------------------------------------------------------
-- Chore chart + rewards/points.
-- ---------------------------------------------------------------------------
-- recurrence: none | daily | weekly | specific-days
-- days_of_week: 7-bit mask, Sunday=bit0 .. Saturday=bit6 (used when recurrence
--   is weekly/specific-days; e.g. Mon+Wed+Fri = 2+8+32 = 42).
CREATE TABLE IF NOT EXISTS chores (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  member_id     INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  points        INTEGER NOT NULL DEFAULT 1,
  recurrence    TEXT NOT NULL DEFAULT 'none',
  days_of_week  INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  notes         TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chores_member ON chores(member_id);
CREATE INDEX IF NOT EXISTS idx_chores_active ON chores(active);

CREATE TABLE IF NOT EXISTS chore_completions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  chore_id       INTEGER NOT NULL REFERENCES chores(id) ON DELETE CASCADE,
  member_id      INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  completed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  completed_on   TEXT NOT NULL,            -- local date (YYYY-MM-DD) the chore counts for
  points_awarded INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_chore_comp_chore  ON chore_completions(chore_id);
CREATE INDEX IF NOT EXISTS idx_chore_comp_member ON chore_completions(member_id);
CREATE INDEX IF NOT EXISTS idx_chore_comp_on     ON chore_completions(completed_on);
-- One completion per chore per day keeps daily/weekly rollover clean and makes
-- "mark done" idempotent for a given day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chore_comp_unique
  ON chore_completions(chore_id, completed_on);

-- ---------------------------------------------------------------------------
-- Meal planner — one row per date+slot(+title). A day can hold several meals
-- per slot (e.g. two snack ideas) so no unique constraint on (date, slot).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,               -- local date (YYYY-MM-DD)
  slot        TEXT NOT NULL DEFAULT 'dinner', -- breakfast | lunch | dinner | snack
  title       TEXT NOT NULL,
  notes       TEXT,
  recipe_url  TEXT,
  member_id   INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_meals_date ON meals(date);

-- ---------------------------------------------------------------------------
-- Shopping / grocery lists.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_lists (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id     INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  qty         TEXT,                         -- freeform "2 lbs", "1 dozen"
  checked     INTEGER NOT NULL DEFAULT 0,
  member_id   INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);

-- Seed a default "Groceries" list (only if none exist yet — idempotent).
INSERT INTO shopping_lists (name, sort_order)
SELECT 'Groceries', 0
WHERE NOT EXISTS (SELECT 1 FROM shopping_lists);

-- ---------------------------------------------------------------------------
-- ICS calendar subscriptions (iCloud / Outlook / any public .ics URL).
-- Fetched + parsed on a schedule; merged read-only into events as source=ics.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_subscriptions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  color        TEXT NOT NULL DEFAULT '#6c9ae8',
  member_id    INTEGER REFERENCES family_members(id) ON DELETE SET NULL,
  enabled      INTEGER NOT NULL DEFAULT 1,
  last_synced  TEXT,
  last_error   TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ICS-sourced events reuse the events table. source='ics'; the external UID is
-- stored in google_id and the subscription id (as text) in google_cal_id so the
-- existing unique (google_cal_id, google_id) index dedupes them too.
CREATE INDEX IF NOT EXISTS idx_events_ics ON events(source);

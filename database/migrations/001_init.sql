-- Migration 001: core schema
-- Categories are shared across calendar events, tasks, and school items.

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#8b7bf6', -- hex; validated at API layer
  icon        TEXT,
  kind        TEXT NOT NULL DEFAULT 'general',  -- general | school | personal
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  location      TEXT,
  start         TEXT NOT NULL,            -- ISO 8601
  "end"         TEXT NOT NULL,            -- ISO 8601
  all_day       INTEGER NOT NULL DEFAULT 0,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  color         TEXT,                     -- override color
  source        TEXT NOT NULL DEFAULT 'local', -- local | google
  google_id     TEXT,                     -- external id when source=google
  google_cal_id TEXT,
  rrule         TEXT,                     -- recurrence (stored, expanded client-side)
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start);
CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_google
  ON events(google_cal_id, google_id) WHERE google_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT NOT NULL,
  notes        TEXT,
  due          TEXT,                      -- ISO 8601 or NULL
  priority     TEXT NOT NULL DEFAULT 'normal', -- low | normal | high
  category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);

CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT,
  body        TEXT NOT NULL DEFAULT '',
  color       TEXT NOT NULL DEFAULT '#fff7ed',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(pinned);

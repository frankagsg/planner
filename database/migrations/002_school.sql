-- Migration 002: school module (classes, clinicals, assignments, exams, study, notes)

CREATE TABLE IF NOT EXISTS school_classes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  code         TEXT,                       -- e.g. NUR-201
  instructor   TEXT,
  color        TEXT NOT NULL DEFAULT '#7cc4a4',
  term         TEXT,                       -- e.g. "Fall 2026"
  schedule     TEXT,                       -- freeform "Mon/Wed 9-11am"
  location     TEXT,
  archived     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- kind: assignment | exam | clinical | study | reading | project
CREATE TABLE IF NOT EXISTS school_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id     INTEGER REFERENCES school_classes(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'assignment',
  due          TEXT,                       -- ISO 8601
  notes        TEXT,
  completed    INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_school_items_due ON school_items(due);
CREATE INDEX IF NOT EXISTS idx_school_items_class ON school_items(class_id);
CREATE INDEX IF NOT EXISTS idx_school_items_completed ON school_items(completed);

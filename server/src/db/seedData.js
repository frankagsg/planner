import db from './index.js';

// All demo rows are tagged so they can be cleanly removed later.
// Events/tasks/etc. don't have a dedicated flag column, so demo seeding uses a
// settings-tracked id manifest for precise, reversible removal.

function iso(daysFromNow, hour = 9, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}
function dateOnly(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function recordDemoIds(manifest) {
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES ('_demoManifest', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`
  ).run(JSON.stringify(manifest));
}

export function seedDemoData() {
  const manifest = {
    categories: [], events: [], tasks: [], notes: [],
    classes: [], schoolItems: [], countdowns: [], personalEvents: [],
  };

  const tx = db.transaction(() => {
    // Categories
    const cats = [
      ['Family', '#e8a0bf', 'heart', 'general'],
      ['Work', '#7aa2f7', 'briefcase', 'general'],
      ['Health', '#7cc4a4', 'activity', 'general'],
      ['School', '#f0b866', 'graduation-cap', 'school'],
    ];
    const catStmt = db.prepare(
      'INSERT INTO categories (name,color,icon,kind) VALUES (?,?,?,?)'
    );
    const catIds = {};
    for (const c of cats) {
      const info = catStmt.run(...c);
      catIds[c[0]] = info.lastInsertRowid;
      manifest.categories.push(info.lastInsertRowid);
    }

    // Events
    const evStmt = db.prepare(
      `INSERT INTO events (title,description,location,start,"end",all_day,category_id,source)
       VALUES (?,?,?,?,?,?,?,'local')`
    );
    const events = [
      ['Morning yoga', 'Living room flow', 'Home', iso(0, 7, 0), iso(0, 7, 45), 0, catIds.Health],
      ['Team standup', null, 'Zoom', iso(0, 10, 0), iso(0, 10, 30), 0, catIds.Work],
      ['Date night 💛', 'Italian place downtown', 'Trattoria', iso(2, 19, 0), iso(2, 21, 0), 0, catIds.Family],
      ['Dentist', 'Cleaning', 'Dr. Rossi', iso(4, 14, 0), iso(4, 15, 0), 0, catIds.Health],
      ['Farmers market', null, 'Town Square', iso(5, 9, 0), iso(5, 11, 0), 0, catIds.Family],
    ];
    for (const e of events) manifest.events.push(evStmt.run(...e).lastInsertRowid);

    // Tasks
    const tStmt = db.prepare(
      'INSERT INTO tasks (title,notes,due,priority,category_id,completed) VALUES (?,?,?,?,?,?)'
    );
    const tasks = [
      ['Buy groceries', 'Milk, eggs, basil', iso(0, 17, 0), 'normal', catIds.Family, 0],
      ['Call pharmacy', 'Refill prescription', iso(0, 12, 0), 'high', catIds.Health, 0],
      ['Finish slide deck', null, iso(1, 16, 0), 'high', catIds.Work, 0],
      ['Water the plants', null, iso(1, 8, 0), 'low', catIds.Family, 0],
      ['Book flights', 'Spring trip', iso(9, 20, 0), 'normal', catIds.Family, 0],
      ['Laundry', null, null, 'low', null, 1],
    ];
    for (const t of tasks) manifest.tasks.push(tStmt.run(...t).lastInsertRowid);

    // Notes
    const nStmt = db.prepare('INSERT INTO notes (title,body,color,pinned) VALUES (?,?,?,?)');
    const notes = [
      ['Wifi password', 'Guest network: SunnyDay2026', '#fff7ed', 1],
      ['Grocery staples', 'Olive oil, pasta, garlic, tomatoes, parmesan', '#eef7f0', 0],
      ['Ideas', 'Repaint the porch\nFix the squeaky door\nPlant tomatoes', '#f3f0ff', 0],
    ];
    for (const n of notes) manifest.notes.push(nStmt.run(...n).lastInsertRowid);

    // School classes + items
    const cStmt = db.prepare(
      'INSERT INTO school_classes (name,code,instructor,color,term,schedule) VALUES (?,?,?,?,?,?)'
    );
    const classes = [
      ['Anatomy & Physiology II', 'BIO-202', 'Dr. Bianchi', '#7cc4a4', 'Fall 2026', 'Mon/Wed 9–11am'],
      ['Nursing Fundamentals', 'NUR-201', 'Prof. Greene', '#7aa2f7', 'Fall 2026', 'Tue/Thu 1–3pm'],
      ['Clinical Rotation', 'NUR-210', 'Ms. Alvarez', '#e8a0bf', 'Fall 2026', 'Fri 7am–1pm'],
    ];
    const classIds = [];
    for (const c of classes) {
      const id = cStmt.run(...c).lastInsertRowid;
      classIds.push(id);
      manifest.classes.push(id);
    }
    const siStmt = db.prepare(
      'INSERT INTO school_items (class_id,title,kind,due,notes,completed) VALUES (?,?,?,?,?,?)'
    );
    const items = [
      [classIds[0], 'Chapter 12 problem set', 'assignment', iso(1, 23, 59), null, 0],
      [classIds[0], 'Midterm exam', 'exam', iso(6, 9, 0), 'Chapters 8–12', 0],
      [classIds[1], 'Care plan write-up', 'assignment', iso(2, 23, 59), null, 0],
      [classIds[1], 'Reading: Ch. 5', 'reading', iso(0, 23, 59), null, 0],
      [classIds[2], 'Clinical prep checklist', 'clinical', iso(3, 6, 30), 'Bring stethoscope', 0],
      [classIds[0], 'Lab report', 'assignment', iso(-1, 23, 59), 'Late — submit ASAP', 0],
      [classIds[1], 'Quiz 3', 'exam', iso(-3, 9, 0), null, 1],
    ];
    for (const it of items) manifest.schoolItems.push(siStmt.run(...it).lastInsertRowid);

    // Countdowns
    const cdStmt = db.prepare('INSERT INTO countdowns (label,target,color,icon) VALUES (?,?,?,?)');
    const cds = [
      ['Anniversary', iso(23, 0, 0), '#e8a0bf', 'heart'],
      ['Semester ends', iso(70, 0, 0), '#7aa2f7', 'graduation-cap'],
      ['Spring trip', iso(45, 0, 0), '#7cc4a4', 'plane'],
    ];
    for (const c of cds) manifest.countdowns.push(cdStmt.run(...c).lastInsertRowid);

    // Personal
    db.prepare(
      `UPDATE personal_config SET enabled=1, partner_a='Frank', partner_b='Jessie',
       message='Proud of you, always 💛', next_date_at=?, next_date_note='Trattoria downtown'
       WHERE id=1`
    ).run(iso(2, 19, 0));
    const peStmt = db.prepare('INSERT INTO personal_events (title,at,note) VALUES (?,?,?)');
    const pes = [
      ['Movie night', iso(1, 20, 0), 'Pick something cozy'],
      ['Weekend hike', iso(6, 8, 0), 'Trailhead at 8'],
    ];
    for (const p of pes) manifest.personalEvents.push(peStmt.run(...p).lastInsertRowid);

    recordDemoIds(manifest);
  });

  tx();
  return manifest;
}

export function clearDemoData() {
  const row = db.prepare("SELECT value FROM settings WHERE key='_demoManifest'").get();
  if (!row) return { cleared: false };
  let manifest;
  try {
    manifest = JSON.parse(row.value);
  } catch {
    return { cleared: false };
  }

  const tx = db.transaction(() => {
    const del = (table, ids) => {
      if (!ids?.length) return;
      const stmt = db.prepare(`DELETE FROM ${table} WHERE id = ?`);
      for (const id of ids) stmt.run(id);
    };
    del('events', manifest.events);
    del('tasks', manifest.tasks);
    del('notes', manifest.notes);
    del('school_items', manifest.schoolItems);
    del('school_classes', manifest.classes);
    del('countdowns', manifest.countdowns);
    del('personal_events', manifest.personalEvents);
    del('categories', manifest.categories);
    // Reset personal message back to default-ish.
    db.prepare(
      `UPDATE personal_config SET message='Love you 💛', next_date_at=NULL, next_date_note=NULL WHERE id=1`
    ).run();
    db.prepare("DELETE FROM settings WHERE key='_demoManifest'").run();
  });
  tx();
  return { cleared: true };
}

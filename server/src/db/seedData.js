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
  // Local date (not UTC) so it lines up with the app's local-day logic.
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
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
    familyMembers: [], chores: [], choreCompletions: [], meals: [],
    shoppingLists: [], shoppingItems: [], subscriptions: [],
  };

  const tx = db.transaction(() => {
    // ---- Family members (the backbone the rest color-codes against) ----
    const fmStmt = db.prepare(
      'INSERT INTO family_members (name,color,emoji,role,sort_order) VALUES (?,?,?,?,?)'
    );
    const fam = [
      ['Frank', '#6c9ae8', null, 'adult', 0],
      ['Jessie', '#e382a8', '🌸', 'adult', 1],
      ['Mia', '#7cc4a4', '🦊', 'child', 2],
      ['Leo', '#f0b866', '🚀', 'child', 3],
    ];
    const memberIds = {};
    for (const m of fam) {
      const id = fmStmt.run(...m).lastInsertRowid;
      memberIds[m[0]] = id;
      manifest.familyMembers.push(id);
    }
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
      `INSERT INTO events (title,description,location,start,"end",all_day,category_id,member_id,source)
       VALUES (?,?,?,?,?,?,?,?,'local')`
    );
    const events = [
      ['Morning yoga', 'Living room flow', 'Home', iso(0, 7, 0), iso(0, 7, 45), 0, catIds.Health, memberIds.Jessie],
      ['Team standup', null, 'Zoom', iso(0, 10, 0), iso(0, 10, 30), 0, catIds.Work, memberIds.Frank],
      ['Date night 💛', 'Italian place downtown', 'Trattoria', iso(2, 19, 0), iso(2, 21, 0), 0, catIds.Family, null],
      ['Dentist', 'Cleaning', 'Dr. Rossi', iso(4, 14, 0), iso(4, 15, 0), 0, catIds.Health, memberIds.Mia],
      ['Soccer practice', 'Bring water bottle', 'Field 3', iso(1, 16, 0), iso(1, 17, 30), 0, catIds.Family, memberIds.Leo],
      ['Farmers market', null, 'Town Square', iso(5, 9, 0), iso(5, 11, 0), 0, catIds.Family, null],
    ];
    for (const e of events) manifest.events.push(evStmt.run(...e).lastInsertRowid);

    // Tasks
    const tStmt = db.prepare(
      'INSERT INTO tasks (title,notes,due,priority,category_id,member_id,completed) VALUES (?,?,?,?,?,?,?)'
    );
    const tasks = [
      ['Buy groceries', 'Milk, eggs, basil', iso(0, 17, 0), 'normal', catIds.Family, null, 0],
      ['Call pharmacy', 'Refill prescription', iso(0, 12, 0), 'high', catIds.Health, memberIds.Frank, 0],
      ['Finish slide deck', null, iso(1, 16, 0), 'high', catIds.Work, memberIds.Frank, 0],
      ['Water the plants', null, iso(1, 8, 0), 'low', catIds.Family, memberIds.Mia, 0],
      ['Book flights', 'Spring trip', iso(9, 20, 0), 'normal', catIds.Family, memberIds.Jessie, 0],
      ['Laundry', null, null, 'low', null, null, 1],
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

    // ---- Chores + a few completions (kid-friendly points) ----
    const chStmt = db.prepare(
      'INSERT INTO chores (title,member_id,points,recurrence,days_of_week,notes,sort_order) VALUES (?,?,?,?,?,?,?)'
    );
    // days mask: Sun=1..Sat=64. Mon+Wed+Fri = 2+8+32 = 42. Sat+Sun = 65.
    const chores = [
      ['Make your bed', memberIds.Mia, 5, 'daily', 0, null, 0],
      ['Feed the dog', memberIds.Leo, 5, 'daily', 0, 'Morning + evening', 1],
      ['Take out the trash', memberIds.Frank, 10, 'specific-days', 42, 'Mon/Wed/Fri', 2],
      ['Set the table', memberIds.Mia, 3, 'daily', 0, null, 3],
      ['Tidy playroom', memberIds.Leo, 8, 'weekly', 65, 'Weekends', 4],
      ['Water the garden', memberIds.Jessie, 6, 'specific-days', 20, 'Tue/Thu', 5],
    ];
    const choreIds = {};
    for (const c of chores) {
      const id = chStmt.run(...c).lastInsertRowid;
      choreIds[c[0]] = id;
      manifest.chores.push(id);
    }
    // Award a couple of completions across the week so the leaderboard is alive.
    const ccStmt = db.prepare(
      'INSERT OR IGNORE INTO chore_completions (chore_id,member_id,completed_at,completed_on,points_awarded) VALUES (?,?,?,?,?)'
    );
    const comps = [
      [choreIds['Make your bed'], memberIds.Mia, dateOnly(-1), 5],
      [choreIds['Make your bed'], memberIds.Mia, dateOnly(-2), 5],
      [choreIds['Feed the dog'], memberIds.Leo, dateOnly(-1), 5],
      [choreIds['Set the table'], memberIds.Mia, dateOnly(-1), 3],
      [choreIds['Take out the trash'], memberIds.Frank, dateOnly(-2), 10],
      [choreIds['Water the garden'], memberIds.Jessie, dateOnly(-3), 6],
    ];
    for (const [choreId, mId, on, pts] of comps) {
      const info = ccStmt.run(choreId, mId, iso(0, 8, 0), on, pts);
      if (info.lastInsertRowid) manifest.choreCompletions.push(info.lastInsertRowid);
    }

    // ---- Meals for the next few days ----
    const mlStmt = db.prepare(
      'INSERT INTO meals (date,slot,title,notes,recipe_url) VALUES (?,?,?,?,?)'
    );
    const meals = [
      [dateOnly(0), 'breakfast', 'Oatmeal & berries', null, null],
      [dateOnly(0), 'dinner', 'Spaghetti & meatballs', 'Spaghetti\nGround beef\nTomato sauce\nParmesan', 'https://example.com/spaghetti'],
      [dateOnly(1), 'dinner', 'Grilled chicken salad', 'Chicken breast\nRomaine\nCherry tomatoes', null],
      [dateOnly(2), 'dinner', 'Taco night 🌮', 'Tortillas\nGround turkey\nCheese\nSalsa', null],
      [dateOnly(3), 'lunch', 'Leftover tacos', null, null],
      [dateOnly(4), 'dinner', 'Homemade pizza', 'Pizza dough\nMozzarella\nBasil', null],
    ];
    for (const m of meals) manifest.meals.push(mlStmt.run(...m).lastInsertRowid);

    // ---- Shopping: reuse the default Groceries list, add a second list ----
    let groceriesId = db
      .prepare("SELECT id FROM shopping_lists ORDER BY sort_order ASC, id ASC LIMIT 1")
      .get()?.id;
    if (!groceriesId) {
      groceriesId = db
        .prepare("INSERT INTO shopping_lists (name, sort_order) VALUES ('Groceries', 0)")
        .run().lastInsertRowid;
      manifest.shoppingLists.push(groceriesId);
    }
    const hardwareId = db
      .prepare("INSERT INTO shopping_lists (name, sort_order) VALUES ('Hardware store', 1)")
      .run().lastInsertRowid;
    manifest.shoppingLists.push(hardwareId);

    const siStmt2 = db.prepare(
      'INSERT INTO shopping_items (list_id,text,qty,checked,member_id,sort_order) VALUES (?,?,?,?,?,?)'
    );
    const items2 = [
      [groceriesId, 'Milk', '1 gal', 0, null, 0],
      [groceriesId, 'Eggs', '1 dozen', 0, null, 1],
      [groceriesId, 'Fresh basil', null, 0, memberIds.Jessie, 2],
      [groceriesId, 'Parmesan', null, 1, null, 3],
      [groceriesId, 'Apples', '6', 0, memberIds.Mia, 4],
      [hardwareId, 'Wood screws', '1 box', 0, memberIds.Frank, 0],
      [hardwareId, 'Paint roller', null, 0, memberIds.Frank, 1],
    ];
    for (const it of items2) manifest.shoppingItems.push(siStmt2.run(...it).lastInsertRowid);

    // ---- A demo ICS subscription (disabled so it never hits the network) ----
    const subInfo = db
      .prepare(
        `INSERT INTO calendar_subscriptions (name,url,color,enabled,last_synced)
         VALUES (?,?,?,0,?)`
      )
      .run(
        'US Holidays (sample)',
        'https://www.google.com/calendar/ical/en.usa%23holiday%40group.v.calendar.google.com/public/basic.ics',
        '#9580e0',
        null
      );
    manifest.subscriptions.push(subInfo.lastInsertRowid);

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
    // Family hub (order matters: completions/items before their parents).
    del('chore_completions', manifest.choreCompletions);
    del('chores', manifest.chores);
    del('meals', manifest.meals);
    del('shopping_items', manifest.shoppingItems);
    del('shopping_lists', manifest.shoppingLists);
    del('calendar_subscriptions', manifest.subscriptions);
    del('family_members', manifest.familyMembers);
    // Reset personal message back to default-ish.
    db.prepare(
      `UPDATE personal_config SET message='Love you 💛', next_date_at=NULL, next_date_note=NULL WHERE id=1`
    ).run();
    db.prepare("DELETE FROM settings WHERE key='_demoManifest'").run();
  });
  tx();
  return { cleared: true };
}

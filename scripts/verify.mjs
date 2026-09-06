#!/usr/bin/env node
// End-to-end smoke test: starts the server, hits key endpoints, checks the
// built client exists, then exits non-zero on any failure.
// Usage: node scripts/verify.mjs   (run from repo root after building client)

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { once } from 'node:events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 4055;
const base = `http://localhost:${PORT}`;

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass++;
    console.log(`  \u2713 ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    fail++;
    console.error(`  \u2717 ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function get(pathname) {
  const res = await fetch(base + pathname);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

async function send(method, pathname, body) {
  const res = await fetch(base + pathname, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    /* not json */
  }
  return { status: res.status, json, text };
}

console.log('Wall Planner verification');
console.log('=========================');

// Client build present?
const dist = path.join(repoRoot, 'client', 'dist', 'index.html');
check('client build exists (client/dist/index.html)', fs.existsSync(dist));

// Start server on a test port with a temp DB so we don't disturb real data.
const server = spawn('node', ['src/index.js'], {
  cwd: path.join(repoRoot, 'server'),
  env: {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    DATABASE_PATH: './database/verify.db',
    BACKUP_INTERVAL_HOURS: '0',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitForHealth(timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await get('/api/health');
      if (r.status === 200) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

try {
  const healthy = await waitForHealth();
  check('server starts and health endpoint responds', healthy);
  if (!healthy) {
    console.error('\nServer log:\n' + serverLog);
    throw new Error('server did not become healthy');
  }

  const health = await get('/api/health');
  check('health returns status ok', health.json?.status === 'ok');

  // Seed some data through the API to prove writes work.
  await fetch(base + '/api/setup/demo/seed', { method: 'POST' });

  const tasks = await get('/api/tasks?filter=all');
  check('tasks endpoint returns array', Array.isArray(tasks.json), `${tasks.json?.length} tasks`);

  const events = await get('/api/events');
  check('events endpoint returns array', Array.isArray(events.json), `${events.json?.length} events`);

  const notes = await get('/api/notes');
  check('notes endpoint returns array', Array.isArray(notes.json), `${notes.json?.length} notes`);

  const school = await get('/api/school/summary');
  check('school summary returns counts', typeof school.json?.remaining === 'number');

  const settings = await get('/api/settings');
  check('settings endpoint returns object', settings.json && typeof settings.json === 'object');

  const dash = await get('/api/dashboard');
  check('dashboard aggregate returns data', dash.json && 'todayEvents' in dash.json);

  const gstatus = await get('/api/google/status');
  check('google status returns configured flag', typeof gstatus.json?.configured === 'boolean');

  const spa = await get('/');
  check('serves built SPA at /', spa.status === 200 && spa.text.includes('<div id="root">'));

  const fallback = await get('/calendar');
  check('SPA fallback works for client routes', fallback.status === 200);

  const notFound = await get('/api/does-not-exist');
  check('unknown API route returns 404', notFound.status === 404);

  // ---------------------------------------------------------------------
  // Family hub: members, chores, meals, shopping, subscriptions.
  // ---------------------------------------------------------------------
  const famList = await get('/api/family');
  check('family list returns array', Array.isArray(famList.json), `${famList.json?.length} members`);

  const newMember = await send('POST', '/api/family', {
    name: 'Verify Kid',
    color: '#7cc4a4',
    role: 'child',
  });
  check('family member create returns id', typeof newMember.json?.id === 'number');
  const memberId = newMember.json?.id;

  const memberUpdate = await send('PUT', `/api/family/${memberId}`, { emoji: '🦊' });
  check('family member update persists emoji', memberUpdate.json?.emoji === '🦊');

  // Task assigned to the member + member filter.
  const memberTask = await send('POST', '/api/tasks', { title: 'Verify chore task', member_id: memberId });
  check('task accepts member_id', memberTask.json?.member_id === memberId);
  const filteredTasks = await get(`/api/tasks?filter=all&member_id=${memberId}`);
  check(
    'tasks filter by member works',
    Array.isArray(filteredTasks.json) && filteredTasks.json.every((t) => t.member_id === memberId)
  );

  // Chores: create, list today, complete (points), leaderboard, undo.
  const newChore = await send('POST', '/api/chores', {
    title: 'Verify chore',
    member_id: memberId,
    points: 7,
    recurrence: 'daily',
  });
  check('chore create returns id', typeof newChore.json?.id === 'number');
  const choreId = newChore.json?.id;

  const choresToday = await get('/api/chores/today');
  check(
    'chores/today returns applicable chores',
    Array.isArray(choresToday.json?.chores) && choresToday.json.chores.some((c) => c.id === choreId)
  );

  const doneChore = await send('POST', `/api/chores/${choreId}/complete`, {});
  check('chore complete awards points', doneChore.json?.completion?.points_awarded === 7);

  const dupChore = await send('POST', `/api/chores/${choreId}/complete`, {});
  check('chore complete is idempotent per day', dupChore.status === 200 || dupChore.status === 201);

  const board = await get('/api/chores/leaderboard');
  const entry = board.json?.board?.find((b) => b.member.id === memberId);
  check('leaderboard reflects awarded points', entry && entry.weekPoints >= 7);

  const choreWeek = await get('/api/chores/week');
  check('chores/week returns a 7-day grid', Array.isArray(choreWeek.json?.dates) && choreWeek.json.dates.length === 7);

  const undo = await send('POST', `/api/chores/${choreId}/undo`, {});
  check('chore undo works', undo.json?.chore?.done === false);

  // Meals: create + week fetch + add-ingredients -> grocery list.
  const today = new Date();
  const off = today.getTimezoneOffset();
  const todayStr = new Date(today.getTime() - off * 60000).toISOString().slice(0, 10);
  const newMeal = await send('POST', '/api/meals', {
    date: todayStr,
    slot: 'dinner',
    title: 'Verify dinner',
  });
  check('meal create returns id', typeof newMeal.json?.id === 'number');
  const mealWeek = await get('/api/meals/week');
  check('meals/week returns dates + slots', Array.isArray(mealWeek.json?.dates) && Array.isArray(mealWeek.json?.slots));

  const addIng = await send('POST', '/api/meals/add-ingredients', { items: ['Verify carrots', 'Verify peas'] });
  check('meal add-ingredients pushes to a list', Array.isArray(addIng.json?.added) && addIng.json.added.length === 2);

  // Shopping: lists, items, toggle, clear-checked.
  const lists = await get('/api/shopping/lists');
  check('shopping lists include default Groceries', Array.isArray(lists.json) && lists.json.some((l) => l.name === 'Groceries'));
  const listId = lists.json?.[0]?.id;

  const newItem = await send('POST', '/api/shopping/items', { list_id: listId, text: 'Verify milk' });
  check('shopping item create returns id', typeof newItem.json?.id === 'number');
  const itemId = newItem.json?.id;

  const toggled = await send('POST', `/api/shopping/items/${itemId}/toggle`);
  check('shopping item toggle checks it', toggled.json?.checked === 1);

  const cleared = await send('POST', `/api/shopping/lists/${listId}/clear-checked`);
  check('shopping clear-checked returns a count', typeof cleared.json?.cleared === 'number' && cleared.json.cleared >= 1);

  // Subscriptions: validation rejects bad URL; add + sync attempt is graceful.
  const badSub = await send('POST', '/api/subscriptions', { name: 'Bad', url: 'not-a-url' });
  check('subscription rejects invalid URL', badSub.status === 400);

  const localSub = await send('POST', '/api/subscriptions', { name: 'Local', url: 'http://localhost/x.ics' });
  check('subscription blocks local addresses', localSub.status === 400);

  const goodSub = await send('POST', '/api/subscriptions', {
    name: 'Verify feed',
    url: 'https://example.com/nonexistent-verify.ics',
  });
  check(
    'subscription add returns a graceful sync result (no crash)',
    goodSub.status === 201 && goodSub.json?.subscription && 'sync' in goodSub.json
  );

  const subList = await get('/api/subscriptions');
  check('subscription list returns array', Array.isArray(subList.json));

  const stillHealthy = await get('/api/health');
  check('server survived a failing ICS fetch', stillHealthy.json?.status === 'ok');

  // Dashboard now includes family-hub aggregates.
  const dash2 = await get('/api/dashboard');
  check(
    'dashboard includes family-hub data',
    dash2.json &&
      'familyMembers' in dash2.json &&
      'choresToday' in dash2.json &&
      'mealsToday' in dash2.json &&
      'groceryOpen' in dash2.json
  );

  // Clean up demo data + temp db.
  await fetch(base + '/api/setup/demo/clear', { method: 'POST' });
} catch (err) {
  fail++;
  console.error('  \u2717 exception:', err.message);
} finally {
  const stopped = server.exitCode === null ? once(server, 'exit') : Promise.resolve();
  server.kill('SIGTERM');
  await stopped; // Windows keeps the SQLite file locked until the process exits.
  // Remove temp verify DB.
  for (const suffix of ['', '-wal', '-shm']) {
    const f = path.join(repoRoot, 'database', 'verify.db' + suffix);
    if (fs.existsSync(f)) fs.rmSync(f);
  }
}

console.log('=========================');
console.log(`Passed: ${pass}  Failed: ${fail}`);
process.exit(fail === 0 ? 0 : 1);

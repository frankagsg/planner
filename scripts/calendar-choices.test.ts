import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarChoices, eventCalendarId } from '../client/src/lib/calendarChoices.ts';

const event = (source: 'ics' | 'google' | 'local', calendar?: string) => ({
  id: 1, title: 'Appointment', start: '2026-09-06', end: '2026-09-07', all_day: 1,
  source, google_cal_id: calendar,
});

test('subscriptions remain selectable before their first event, with saved names and colors', () => {
  const choices = calendarChoices([], [{ id: 2, name: 'Jessie', color: '#e382a8' }], []);
  assert.deepEqual(choices.map(c => c.name), ['Planner events', 'Jessie']);
  assert.equal(choices[1].color, '#e382a8');
  assert.equal(choices[1].id, eventCalendarId(event('ics', 'ics:2')));
});

test('Google and subscribed copies are separate and repeated events do not duplicate buttons', () => {
  const events = [event('google', 'ics:2'), event('ics', 'ics:2'), event('ics', 'ics:2')];
  const choices = calendarChoices(events, [{ id: 2, name: 'Personal', color: '#abcdef' }], [
    { id: 'ics:2', summary: 'Frank', backgroundColor: '#123456' },
  ]);
  assert.equal(choices.length, 3);
  assert.notEqual(eventCalendarId(events[0]), eventCalendarId(events[1]));
  assert.equal(choices[2].name, 'Frank (Google)');
});

test('imported events remain selectable when provider metadata is unavailable', () => {
  const events = [event('google', 'primary@example.com'), event('ics', 'ics:7'), event('local')];
  const choices = calendarChoices(events, [], []);
  for (const item of events) assert.ok(choices.some(c => c.id === eventCalendarId(item)));
});

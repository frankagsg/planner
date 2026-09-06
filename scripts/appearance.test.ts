import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAppearance, readAppearance, isDarkAppearance, parseThemeFile, appearanceTokens, DEFAULT_APPEARANCE } from '../client/src/lib/appearance.ts';

test('existing themes and photo backgrounds migrate without losing the current look', () => {
  const a = readAppearance({ 'display.theme': 'dark', 'display.accent': 'sage', 'display.homeBackground': '/photos/family-123.jpg' });
  assert.equal(a.mode, 'dark'); assert.equal(a.dark.accent, '#6fb291');
  assert.deepEqual(a.background.photos, ['/photos/family-123.jpg']);
  assert.equal(a.background.kind, 'photo'); assert.equal(a.background.scope, 'home');
  assert.equal(a.background.dim, 60);
});
test('day/night schedule switches at both boundaries, including schedules across midnight', () => {
  const a = normalizeAppearance({ ...DEFAULT_APPEARANCE, mode: 'schedule' });
  const at = (h: number, m = 0) => new Date(2026, 8, 5, h, m);
  assert.equal(isDarkAppearance(a, false, at(6, 59)), true);
  assert.equal(isDarkAppearance(a, true, at(7)), false);
  assert.equal(isDarkAppearance(a, false, at(20)), true);
  a.dayStart = '20:00'; a.nightStart = '07:00';
  assert.equal(isDarkAppearance(a, true, at(23)), false);
  assert.equal(isDarkAppearance(a, false, at(8)), true);
  a.mode = 'auto'; assert.equal(isDarkAppearance(a, true, at(8)), true);
});
test('theme import is bounded and cannot introduce external URLs or CSS', () => {
  const a = parseThemeFile(JSON.stringify({ format: 'wall-planner-theme', version: 1, appearance: { version: 1,
    light: { accent: 'red; background: url(https://example.com)' }, textScale: 999,
    background: { kind: 'slideshow', interval: -1, blur: 500, photos: ['/photos/ok.jpg', '/photos/ok.jpg', 'https://example.com/track.jpg', '/photos/../secret.png', 'javascript:alert(1)'] },
  } }));
  assert.equal(a.light.accent, DEFAULT_APPEARANCE.light.accent);
  assert.equal(a.textScale, 125); assert.equal(a.background.interval, 15); assert.equal(a.background.blur, 20);
  assert.deepEqual(a.background.photos, ['/photos/ok.jpg']);
  assert.throws(() => parseThemeFile('{invalid'));
  assert.throws(() => parseThemeFile(JSON.stringify({ format: 'wall-planner-theme', version: 2 })));
  assert.throws(() => parseThemeFile('a'.repeat(100001)));
});
test('theme exports round trip including both palettes and background placement', () => {
  const a = normalizeAppearance({ ...DEFAULT_APPEARANCE, font: 'serif', background: { ...DEFAULT_APPEARANCE.background, kind: 'photo', photos: ['/photos/room.png'], x: 20, y: 70 } });
  assert.deepEqual(parseThemeFile(JSON.stringify({ format: 'wall-planner-theme', version: 1, appearance: a })), a);
  assert.equal(appearanceTokens(a, true)['--surface'], '26 24 28');
  assert.equal(appearanceTokens(a, false)['--planner-font'], 'Georgia, serif');
});

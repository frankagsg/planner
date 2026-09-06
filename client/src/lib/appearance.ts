import type { Settings } from '../types';

export interface Palette {
  background: string; card: string; text: string; muted: string; border: string; accent: string;
}
export interface Appearance {
  version: 1;
  mode: 'light' | 'dark' | 'auto' | 'schedule';
  dayStart: string;
  nightStart: string;
  light: Palette;
  dark: Palette;
  font: 'rounded' | 'system' | 'serif';
  headingFont: 'rounded' | 'system' | 'serif';
  textScale: number;
  cardOpacity: number;
  cardRadius: number;
  cardBorder: number;
  cardShadow: 'none' | 'soft' | 'strong';
  spacing: 'compact' | 'comfortable' | 'spacious';
  background: {
    kind: 'none' | 'solid' | 'gradient' | 'photo' | 'slideshow';
    scope: 'home' | 'all';
    color: string; colorEnd: string; angle: number;
    photos: string[]; interval: number;
    fit: 'cover' | 'contain'; x: number; y: number; dim: number; blur: number;
  };
}
export interface ThemePreset { id: string; name: string; appearance: Appearance }
export const DEFAULT_APPEARANCE: Appearance = {
  version: 1, mode: 'auto', dayStart: '07:00', nightStart: '20:00',
  light: { background: '#faf7f5', card: '#ffffff', text: '#37302e', muted: '#756865', border: '#ebe4e0', accent: '#e382a8' },
  dark: { background: '#1a181c', card: '#26232a', text: '#f0ebf0', muted: '#bab2be', border: '#3a343e', accent: '#e382a8' },
  font: 'rounded', headingFont: 'rounded', textScale: 100,
  cardOpacity: 100, cardRadius: 24, cardBorder: 1, cardShadow: 'soft', spacing: 'comfortable',
  background: { kind: 'none', scope: 'home', color: '#e9ddd5', colorEnd: '#d8e8e1', angle: 135,
    photos: [], interval: 60, fit: 'cover', x: 50, y: 50, dim: 45, blur: 0 },
};

const ACCENTS: Record<string, string> = { blush: '#e382a8', lavender: '#9580e0', sage: '#6fb291', sky: '#6c9ae8', amber: '#e2a04e' };
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const color = (v: unknown, fallback: string) => typeof v === 'string' && /^#[a-f\d]{6}$/i.test(v) ? v : fallback;
const number = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
function choice<T extends string>(v: unknown, fallback: T, values: readonly T[]): T { return values.includes(v as T) ? v as T : fallback; }
const time = (v: unknown, fallback: string) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : fallback;
export const isPhotoPath = (v: unknown): v is string => typeof v === 'string' && /^\/photos\/[a-zA-Z0-9_-]+\.(jpe?g|png|webp|gif)$/i.test(v);
function palette(v: unknown, fallback: Palette): Palette {
  const p = isObject(v) ? v : {};
  return Object.fromEntries(Object.entries(fallback).map(([key, value]) => [key, color(p[key], value)])) as unknown as Palette;
}

// Only known, bounded values reach CSS. Imported themes cannot introduce URLs,
// arbitrary CSS, unrelated settings, or unbounded slideshow timers.
export function normalizeAppearance(value: unknown): Appearance {
  const a = isObject(value) ? value : {};
  const d = DEFAULT_APPEARANCE;
  const b = isObject(a.background) ? a.background : {};
  return {
    version: 1, mode: choice(a.mode, d.mode, ['light', 'dark', 'auto', 'schedule']),
    dayStart: time(a.dayStart, d.dayStart), nightStart: time(a.nightStart, d.nightStart),
    light: palette(a.light, d.light), dark: palette(a.dark, d.dark),
    font: choice(a.font, d.font, ['rounded', 'system', 'serif']),
    headingFont: choice(a.headingFont, d.headingFont, ['rounded', 'system', 'serif']),
    textScale: number(a.textScale, 100, 90, 125), cardOpacity: number(a.cardOpacity, 100, 25, 100),
    cardRadius: number(a.cardRadius, 24, 0, 40), cardBorder: number(a.cardBorder, 1, 0, 4),
    cardShadow: choice(a.cardShadow, d.cardShadow, ['none', 'soft', 'strong']),
    spacing: choice(a.spacing, d.spacing, ['compact', 'comfortable', 'spacious']),
    background: {
      kind: choice(b.kind, d.background.kind, ['none', 'solid', 'gradient', 'photo', 'slideshow']),
      scope: choice(b.scope, d.background.scope, ['home', 'all']),
      color: color(b.color, d.background.color), colorEnd: color(b.colorEnd, d.background.colorEnd),
      angle: number(b.angle, 135, 0, 360),
      photos: Array.isArray(b.photos) ? [...new Set(b.photos.filter(isPhotoPath))].slice(0, 40) : [],
      interval: number(b.interval, 60, 15, 3600), fit: choice(b.fit, 'cover', ['cover', 'contain']),
      x: number(b.x, 50, 0, 100), y: number(b.y, 50, 0, 100), dim: number(b.dim, 45, 0, 90), blur: number(b.blur, 0, 0, 20),
    },
  };
}

export function readAppearance(settings: Settings): Appearance {
  if (isObject(settings['display.appearance'])) return normalizeAppearance(settings['display.appearance']);
  const a = normalizeAppearance(DEFAULT_APPEARANCE);
  a.mode = choice(settings['display.theme'], 'auto', ['light', 'dark', 'auto']);
  a.light.accent = a.dark.accent = ACCENTS[String(settings['display.accent'])] || ACCENTS.blush;
  const photo = settings['display.homeBackground'];
  if (isPhotoPath(photo)) a.background = { ...a.background, kind: 'photo', photos: [photo], dim: 60, blur: 2 };
  return a;
}

export function isDarkAppearance(a: Appearance, prefersDark: boolean, now = new Date()) {
  if (a.mode === 'dark') return true;
  if (a.mode === 'light') return false;
  if (a.mode === 'auto') return prefersDark;
  const minute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const day = minute(a.dayStart), night = minute(a.nightStart), current = now.getHours() * 60 + now.getMinutes();
  const daytime = day <= night ? current >= day && current < night : current >= day || current < night;
  return !daytime;
}
export function rgb(hex: string) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function mix(a: string, b: string, weight: number) { return rgb(a).map((v, i) => Math.round(v * (1 - weight) + rgb(b)[i] * weight)).join(' '); }
export function contrastRatio(a: string, b: string) {
  const luminance = (hex: string) => rgb(hex).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + .05) / (l2 + .05);
}
export function appearanceTokens(a: Appearance, dark: boolean): Record<string, string> {
  const p = dark ? a.dark : a.light;
  const fonts = { rounded: "'Nunito', system-ui, sans-serif", system: 'system-ui, sans-serif', serif: 'Georgia, serif' };
  return {
    '--surface': rgb(p.background).join(' '), '--surface-card': rgb(p.card).join(' '), '--surface-raised': rgb(p.card).join(' '),
    '--content': rgb(p.text).join(' '), '--content-soft': rgb(p.muted).join(' '), '--content-faint': rgb(p.muted).join(' '),
    '--line': rgb(p.border).join(' '), '--accent': rgb(p.accent).join(' '),
    '--accent-soft': mix(p.card, p.accent, dark ? .2 : .12), '--accent-ink': mix(p.accent, p.text, .7),
    '--accent-label': contrastRatio(p.accent, '#ffffff') >= contrastRatio(p.accent, '#171717') ? '255 255 255' : '23 23 23',
    '--planner-font': fonts[a.font], '--planner-heading-font': a.headingFont === 'rounded' ? "'Baloo 2', 'Nunito', system-ui, sans-serif" : fonts[a.headingFont],
    '--planner-font-size': `${16 * a.textScale / 100}px`, '--card-opacity': String(a.cardOpacity / 100),
    '--card-radius': `${a.cardRadius}px`, '--card-border': `${a.cardBorder}px`,
    '--card-shadow': a.cardShadow === 'none' ? 'none' : a.cardShadow === 'strong' ? '0 12px 32px rgb(0 0 0 / .25)' : '0 4px 20px -6px rgb(0 0 0 / .12)',
    '--planner-gap': a.spacing === 'compact' ? '12px' : a.spacing === 'spacious' ? '28px' : '20px',
    '--planner-card-pad': a.spacing === 'compact' ? '16px' : a.spacing === 'spacious' ? '28px' : '20px',
  };
}

export const BUILTIN_THEMES: ThemePreset[] = [
  { id: 'original', name: 'Blush', appearance: normalizeAppearance(DEFAULT_APPEARANCE) },
  { id: 'linen', name: 'Linen', appearance: normalizeAppearance({ ...DEFAULT_APPEARANCE, mode: 'light', headingFont: 'serif', light: { background: '#f3eee5', card: '#fffdf7', text: '#40392f', muted: '#786c5a', border: '#d8cebb', accent: '#ad754d' }, background: { ...DEFAULT_APPEARANCE.background, kind: 'gradient', color: '#f6eee0', colorEnd: '#d6c3a7' } }) },
  { id: 'garden', name: 'Garden', appearance: normalizeAppearance({ ...DEFAULT_APPEARANCE, mode: 'light', light: { background: '#e9efea', card: '#f8fbf6', text: '#263d32', muted: '#5c7164', border: '#c7d9ca', accent: '#538269' }, background: { ...DEFAULT_APPEARANCE.background, kind: 'gradient', color: '#dcebdd', colorEnd: '#a5c3b9' } }) },
  { id: 'midnight', name: 'Midnight', appearance: normalizeAppearance({ ...DEFAULT_APPEARANCE, mode: 'dark', font: 'system', headingFont: 'system', dark: { background: '#141d30', card: '#202e45', text: '#edf3ff', muted: '#afc0d9', border: '#3c506d', accent: '#9dbbff' }, background: { ...DEFAULT_APPEARANCE.background, kind: 'gradient', color: '#111b32', colorEnd: '#374566' } }) },
  { id: 'lavender', name: 'Lavender', appearance: normalizeAppearance({ ...DEFAULT_APPEARANCE, mode: 'light', light: { background: '#f1eef8', card: '#fcfaff', text: '#403451', muted: '#776688', border: '#ded4eb', accent: '#9580e0' }, background: { ...DEFAULT_APPEARANCE.background, kind: 'gradient', color: '#ebe0f7', colorEnd: '#eecfdc' } }) },
];

export function readPresets(value: unknown): ThemePreset[] {
  return Array.isArray(value) ? value.filter(isObject).filter(p => typeof p.id === 'string' && typeof p.name === 'string' && isObject(p.appearance))
    .slice(0, 20).map(p => ({ id: String(p.id).slice(0, 80), name: String(p.name).slice(0, 40), appearance: normalizeAppearance(p.appearance) })) : [];
}
export function parseThemeFile(raw: string): Appearance {
  if (raw.length > 100_000) throw new Error('Theme file is too large. Choose a planner theme JSON file.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('This is not a valid JSON theme file.'); }
  if (!isObject(parsed) || parsed.format !== 'wall-planner-theme' || parsed.version !== 1 || !isObject(parsed.appearance) || parsed.appearance.version !== 1) {
    throw new Error('Choose a version 1 Wall Planner theme export.');
  }
  return normalizeAppearance(parsed.appearance);
}

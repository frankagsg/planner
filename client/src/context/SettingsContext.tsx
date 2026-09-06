import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api, readCache, writeCache } from '../lib/api';
import type { Settings } from '../types';
import { appearanceTokens, isDarkAppearance, readAppearance } from '../lib/appearance';

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  get: <T = unknown>(key: string, fallback?: T) => T;
  update: (patch: Settings) => Promise<void>;
  save: (patch: Settings) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<SettingsCtx | null>(null);

const DEFAULTS: Settings = {
  'display.theme': 'auto',
  'display.accent': 'blush',
  'display.clock24h': false,
  'display.showSeconds': false,
  'display.dateFormat': 'EEEE, MMMM d',
  'display.screensaverMinutes': 10,
  'display.screensaverType': 'clock',
  'personal.enabled': true,
  'weather.enabled': true,
};

function applyTheme(settings: Settings) {
  const html = document.documentElement;
  const appearance = readAppearance(settings);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = isDarkAppearance(appearance, prefersDark);
  html.classList.toggle('dark', dark);
  html.style.colorScheme = dark ? 'dark' : 'light';
  for (const [key, value] of Object.entries(appearanceTokens(appearance, dark))) html.style.setProperty(key, value);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(
    () => readCache<Settings>('/api/settings') || DEFAULTS
  );
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    try {
      const s = await api.get<Settings>('/settings', true);
      setSettings(s);
    } catch {
      // offline — keep cached/default
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    reload();
    const timer = window.setInterval(reload, 30_000);
    return () => window.clearInterval(timer);
  }, [reload]);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // React to OS dark-mode changes when theme=auto.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(settings);
    mq.addEventListener('change', handler);
    const timer = window.setInterval(handler, 30_000);
    return () => { mq.removeEventListener('change', handler); window.clearInterval(timer); };
  }, [settings]);

  // Appearance saves are acknowledged by the server before changing the app.
  // Preserve the draft on failure and cache confirmed settings for offline use.
  const save = useCallback(async (patch: Settings) => {
    const next = await api.put<Settings>('/settings', patch);
    writeCache('/api/settings', next);
    setSettings(next);
  }, []);

  const update = useCallback(async (patch: Settings) => {
    // Optimistic local apply for instant UI feedback.
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const next = await api.put<Settings>('/settings', patch);
      setSettings(next);
    } catch {
      /* stays optimistic; will reconcile on next reload */
    }
  }, []);

  const get = useCallback(
    <T,>(key: string, fallback?: T): T => {
      const v = settings[key];
      return (v === undefined ? fallback : v) as T;
    },
    [settings]
  );

  return (
    <Ctx.Provider value={{ settings, ready, get, update, save, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

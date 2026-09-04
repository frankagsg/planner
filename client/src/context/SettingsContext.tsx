import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api, readCache } from '../lib/api';
import type { Settings } from '../types';

interface SettingsCtx {
  settings: Settings;
  ready: boolean;
  get: <T = unknown>(key: string, fallback?: T) => T;
  update: (patch: Settings) => Promise<void>;
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
  const theme = (settings['display.theme'] as string) || 'auto';
  const accent = (settings['display.accent'] as string) || 'blush';
  html.setAttribute('data-accent', accent);

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark);
  html.classList.toggle('dark', dark);
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
  }, [reload]);

  useEffect(() => {
    applyTheme(settings);
  }, [settings]);

  // React to OS dark-mode changes when theme=auto.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme(settings);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings]);

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
    <Ctx.Provider value={{ settings, ready, get, update, reload }}>
      {children}
    </Ctx.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

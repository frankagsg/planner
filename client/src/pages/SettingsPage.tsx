import { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Monitor,
  Palette,
  CalendarDays,
  CloudSun,
  Heart,
  Cpu,
  Cloud,
  Database,
  Power,
  RotateCw,
  MoonStar,
  Download,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useFeedback } from '../components/ui/Feedback';
import { Field, Toggle } from '../components/ui/Field';
import type { GoogleStatus, GoogleCalendar, BackupInfo } from '../types';

const ACCENTS = [
  { key: 'blush', label: 'Blush', color: '#e382a8' },
  { key: 'lavender', label: 'Lavender', color: '#9580e0' },
  { key: 'sage', label: 'Sage', color: '#6fb291' },
  { key: 'sky', label: 'Sky', color: '#6c9ae8' },
  { key: 'amber', label: 'Amber', color: '#e2a04e' },
];

type Tab =
  | 'general'
  | 'display'
  | 'appearance'
  | 'calendar'
  | 'weather'
  | 'personal'
  | 'google'
  | 'backups'
  | 'system';

export default function SettingsPage() {
  const { get, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<Tab>('general');

  const TABS: { key: Tab; label: string; icon: typeof Monitor }[] = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'display', label: 'Display', icon: Monitor },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays },
    { key: 'weather', label: 'Weather', icon: CloudSun },
    { key: 'personal', label: 'Personal', icon: Heart },
    { key: 'google', label: 'Google', icon: Cloud },
    { key: 'backups', label: 'Backups', icon: Database },
    { key: 'system', label: 'System', icon: Cpu },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <h1 className="text-3xl font-display font-bold text-content flex items-center gap-2 mb-5">
        <SettingsIcon className="text-accent" /> Settings
      </h1>

      <div className="flex gap-5 flex-col lg:flex-row">
        <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:w-52 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`btn !justify-start !py-3 ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`}
            >
              <t.icon size={20} /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 card p-6">
          {tab === 'general' && <GeneralTab get={get} update={update} />}
          {tab === 'display' && <DisplayTab get={get} update={update} />}
          {tab === 'appearance' && <AppearanceTab get={get} update={update} />}
          {tab === 'calendar' && <CalendarTab get={get} update={update} />}
          {tab === 'weather' && <WeatherTab get={get} update={update} toast={toast} />}
          {tab === 'personal' && <PersonalTab get={get} update={update} />}
          {tab === 'google' && <GoogleTab toast={toast} />}
          {tab === 'backups' && <BackupsTab toast={toast} confirm={confirm} />}
          {tab === 'system' && <SystemTab toast={toast} confirm={confirm} />}
        </div>
      </div>
    </div>
  );
}

type GetFn = <T = unknown>(k: string, f?: T) => T;
type UpdateFn = (p: Record<string, unknown>) => Promise<void>;

function GeneralTab({ get, update }: { get: GetFn; update: UpdateFn }) {
  const [name, setName] = useState(get<string>('general.householdName', 'Our Home'));
  const [homeLabel, setHomeLabel] = useState(get<string>('nav.homeLabel', 'Home'));
  return (
    <div className="max-w-lg">
      <Field label="Household name" hint="Shown on the home dashboard.">
        <input className="input" value={name} onChange={(e) => setName(e.target.value)}
          onBlur={() => update({ 'general.householdName': name })} />
      </Field>
      <Field label="Home tab label">
        <input className="input" value={homeLabel} onChange={(e) => setHomeLabel(e.target.value)}
          onBlur={() => update({ 'nav.homeLabel': homeLabel })} />
      </Field>
    </div>
  );
}

function DisplayTab({ get, update }: { get: GetFn; update: UpdateFn }) {
  const clock24 = get<boolean>('display.clock24h', false);
  const seconds = get<boolean>('display.showSeconds', false);
  const dateFormat = get<string>('display.dateFormat', 'EEEE, MMMM d');
  const saverMin = get<number>('display.screensaverMinutes', 10);
  const saverType = get<string>('display.screensaverType', 'clock');
  const wake = get<string>('display.screenWake', '07:00');
  const sleep = get<string>('display.screenSleep', '23:30');
  const schedEnabled = get<boolean>('display.screenScheduleEnabled', true);

  return (
    <div className="max-w-lg space-y-5">
      <Toggle checked={clock24} onChange={(v) => update({ 'display.clock24h': v })} label="24-hour clock" />
      <Toggle checked={seconds} onChange={(v) => update({ 'display.showSeconds': v })} label="Show seconds" />
      <Field label="Date format" hint="date-fns pattern, e.g. EEEE, MMMM d">
        <select className="input" data-vkeyboard="off" value={dateFormat}
          onChange={(e) => update({ 'display.dateFormat': e.target.value })}>
          <option value="EEEE, MMMM d">Monday, January 6</option>
          <option value="EEE, MMM d">Mon, Jan 6</option>
          <option value="MMMM d, yyyy">January 6, 2026</option>
          <option value="M/d/yyyy">1/6/2026</option>
          <option value="d MMMM yyyy">6 January 2026</option>
        </select>
      </Field>
      <Field label="Screensaver after (minutes)" hint="0 disables the screensaver.">
        <input type="number" min={0} max={120} data-vkeyboard="off" className="input" value={saverMin}
          onChange={(e) => update({ 'display.screensaverMinutes': Number(e.target.value) })} />
      </Field>
      <Field label="Screensaver style">
        <select className="input" data-vkeyboard="off" value={saverType}
          onChange={(e) => update({ 'display.screensaverType': e.target.value })}>
          <option value="clock">Clock &amp; weather</option>
          <option value="photos">Rotating photos</option>
        </select>
      </Field>

      <div className="border-t border-line pt-4">
        <Toggle checked={schedEnabled} onChange={(v) => update({ 'display.screenScheduleEnabled': v })}
          label="Scheduled screen sleep/wake" />
        <p className="text-sm text-content-faint mt-1 mb-3">
          Enforced on the Pi by a systemd timer (see docs). These values feed the installed schedule.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Wake at">
            <input type="time" data-vkeyboard="off" className="input" value={wake}
              onChange={(e) => update({ 'display.screenWake': e.target.value })} />
          </Field>
          <Field label="Sleep at">
            <input type="time" data-vkeyboard="off" className="input" value={sleep}
              onChange={(e) => update({ 'display.screenSleep': e.target.value })} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function AppearanceTab({ get, update }: { get: GetFn; update: UpdateFn }) {
  const theme = get<string>('display.theme', 'auto');
  const accent = get<string>('display.accent', 'blush');
  return (
    <div className="max-w-lg space-y-6">
      <Field label="Theme">
        <div className="flex gap-2">
          {['light', 'dark', 'auto'].map((t) => (
            <button key={t} onClick={() => update({ 'display.theme': t })}
              className={`btn flex-1 ${theme === t ? 'btn-primary' : 'btn-ghost'}`}>
              {t === 'auto' ? 'Auto' : t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Accent color">
        <div className="flex gap-3 flex-wrap">
          {ACCENTS.map((a) => (
            <button key={a.key} onClick={() => update({ 'display.accent': a.key })}
              className={`flex flex-col items-center gap-1.5 ${accent === a.key ? 'scale-110' : ''} transition`}>
              <span className="w-14 h-14 rounded-full shadow-soft"
                style={{ backgroundColor: a.color, outline: accent === a.key ? '3px solid rgb(var(--accent))' : 'none', outlineOffset: 3 }} />
              <span className="text-sm text-content-soft font-semibold">{a.label}</span>
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function CalendarTab({ get, update }: { get: GetFn; update: UpdateFn }) {
  const view = get<string>('calendar.defaultView', 'timeGridWeek');
  const weekStart = get<number>('calendar.weekStartsOn', 0);
  const start = get<string>('calendar.businessStart', '07:00');
  return (
    <div className="max-w-lg space-y-5">
      <Field label="Default view">
        <select className="input" data-vkeyboard="off" value={view}
          onChange={(e) => update({ 'calendar.defaultView': e.target.value })}>
          <option value="dayGridMonth">Month</option>
          <option value="timeGridWeek">Week</option>
          <option value="timeGridDay">Day</option>
          <option value="listWeek">Agenda</option>
        </select>
      </Field>
      <Field label="Week starts on">
        <select className="input" data-vkeyboard="off" value={weekStart}
          onChange={(e) => update({ 'calendar.weekStartsOn': Number(e.target.value) })}>
          <option value={0}>Sunday</option>
          <option value={1}>Monday</option>
        </select>
      </Field>
      <Field label="Day view starts at">
        <input type="time" data-vkeyboard="off" className="input" value={start}
          onChange={(e) => update({ 'calendar.businessStart': e.target.value })} />
      </Field>
    </div>
  );
}

function WeatherTab({ get, update, toast }: { get: GetFn; update: UpdateFn; toast: (m: string, k?: any) => void }) {
  const enabled = get<boolean>('weather.enabled', true);
  const [lat, setLat] = useState(String(get<number | null>('weather.lat', null) ?? ''));
  const [lon, setLon] = useState(String(get<number | null>('weather.lon', null) ?? ''));
  const [label, setLabel] = useState(get<string>('weather.label', '') ?? '');
  const units = (get<string>('weather.units', '') as string) || '';

  const save = async () => {
    await update({
      'weather.lat': lat ? Number(lat) : null,
      'weather.lon': lon ? Number(lon) : null,
      'weather.label': label || null,
    });
    toast('Weather location saved', 'success');
  };

  return (
    <div className="max-w-lg space-y-5">
      <Toggle checked={enabled} onChange={(v) => update({ 'weather.enabled': v })} label="Show weather" />
      <p className="text-sm text-content-faint">
        The provider and API key are set in <code>.env</code> for security. Location can be set here.
      </p>
      <Field label="Location label">
        <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="New York, NY" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <input className="input" data-vkeyboard="off" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
        </Field>
        <Field label="Longitude">
          <input className="input" data-vkeyboard="off" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
        </Field>
      </div>
      <Field label="Units">
        <select className="input" data-vkeyboard="off" value={units}
          onChange={(e) => update({ 'weather.units': e.target.value || null })}>
          <option value="">Use .env default</option>
          <option value="imperial">Fahrenheit</option>
          <option value="metric">Celsius</option>
        </select>
      </Field>
      <button className="btn-primary" onClick={save}>Save location</button>
    </div>
  );
}

function PersonalTab({ get, update }: { get: GetFn; update: UpdateFn }) {
  const enabled = get<boolean>('personal.enabled', true);
  return (
    <div className="max-w-lg space-y-4">
      <Toggle checked={enabled} onChange={(v) => update({ 'personal.enabled': v })}
        label="Enable the personal section" />
      <p className="text-content-faint">
        Turning this off hides the “Us” tab and its dashboard card entirely. Content is kept and
        returns when you re-enable it. Edit names, message, photos and dates from the Us tab.
      </p>
    </div>
  );
}

function GoogleTab({ toast }: { toast: (m: string, k?: any) => void }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);

  const load = async () => {
    try {
      const s = await api.get<GoogleStatus>('/google/status');
      setStatus(s);
      if (s.connected) setCalendars(await api.get<GoogleCalendar[]>('/google/calendars'));
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    try {
      const { url } = await api.get<{ url: string }>('/google/auth-url');
      window.location.href = url;
    } catch (e: any) {
      toast(e?.message || 'Google is not configured', 'error');
    }
  };
  const disconnect = async () => {
    await api.post('/google/disconnect');
    toast('Disconnected', 'success');
    load();
  };
  const sync = async () => {
    try {
      const r = await api.post<{ synced: number }>('/google/sync');
      toast(`Synced ${r.synced} events`, 'success');
    } catch (e: any) {
      toast(e?.message || 'Sync failed', 'error');
    }
  };
  const toggleCal = async (id: string) => {
    const selected = new Set(status?.selectedCalendars || []);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    const arr = [...selected];
    await api.put('/google/calendars', { calendars: arr });
    setStatus((s) => (s ? { ...s, selectedCalendars: arr } : s));
  };

  if (!status) return <p className="text-content-soft">Loading…</p>;

  if (!status.configured) {
    return (
      <div className="max-w-lg">
        <p className="text-lg text-content mb-2">Google Calendar isn’t configured yet.</p>
        <p className="text-content-soft">
          Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to your{' '}
          <code>.env</code>, then restart the server. See{' '}
          <span className="font-semibold">docs/google-calendar-setup.md</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-4">
      <div className="flex items-center gap-3">
        <span className={`chip ${status.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {status.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>
      {status.connected ? (
        <>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={sync}><RotateCw size={20} /> Sync now</button>
            <button className="btn-ghost" onClick={disconnect}>Disconnect</button>
          </div>
          <Field label="Calendars to show">
            <div className="space-y-2">
              {calendars.map((c) => (
                <label key={c.id} className="flex items-center gap-3 card p-3">
                  <input type="checkbox" className="w-6 h-6 accent-[rgb(var(--accent))]"
                    checked={status.selectedCalendars.includes(c.id)}
                    onChange={() => toggleCal(c.id)} />
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: c.backgroundColor || '#ccc' }} />
                  <span className="text-content font-semibold flex-1">{c.summary}</span>
                  {c.primary && <span className="chip bg-accent-soft text-accent-ink">Primary</span>}
                </label>
              ))}
            </div>
          </Field>
        </>
      ) : (
        <button className="btn-primary" onClick={connect}><Cloud size={20} /> Connect Google Calendar</button>
      )}
    </div>
  );
}

function BackupsTab({ toast, confirm }: { toast: (m: string, k?: any) => void; confirm: any }) {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const load = async () => setBackups(await api.get<BackupInfo[]>('/backups'));
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    await api.post('/backups');
    toast('Backup created', 'success');
    load();
  };
  const restore = async (name: string) => {
    const ok = await confirm({
      title: 'Restore this backup?',
      message: 'Current data is safely backed up first, then replaced. Restart afterward.',
      danger: true,
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    try {
      await api.post(`/backups/${encodeURIComponent(name)}/restore`);
      toast('Restored — restart the app to load it', 'success');
      load();
    } catch (e: any) {
      toast(e?.message || 'Restore failed', 'error');
    }
  };

  const importFile = async (file: File) => {
    const ok = await confirm({
      title: 'Import & restore?',
      message: 'This replaces current data with the uploaded archive.',
      danger: true,
      confirmLabel: 'Import',
    });
    if (!ok) return;
    const res = await fetch('/api/backups/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/zip' },
      body: await file.arrayBuffer(),
    });
    if (res.ok) {
      toast('Imported — restart the app', 'success');
      load();
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j.error || 'Import failed', 'error');
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-2 flex-wrap">
        <button className="btn-primary" onClick={create}><Database size={20} /> Create backup</button>
        <label className="btn-ghost cursor-pointer">
          <Upload size={20} /> Import archive
          <input type="file" accept=".zip" className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      </div>
      {backups.length === 0 ? (
        <p className="text-content-faint">No backups yet.</p>
      ) : (
        <ul className="space-y-2">
          {backups.map((b) => (
            <li key={b.name} className="card p-3 flex items-center gap-3">
              <Database size={20} className="text-content-faint" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-content truncate">{b.name}</div>
                <div className="text-sm text-content-faint">
                  {(b.size / 1024).toFixed(0)} KB · {new Date(b.createdAt).toLocaleString()}
                </div>
              </div>
              <a className="btn-ghost !py-2" href={`/api/backups/${encodeURIComponent(b.name)}/download`}>
                <Download size={18} />
              </a>
              <button className="btn-soft !py-2" onClick={() => restore(b.name)}>Restore</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SystemTab({ toast, confirm }: { toast: (m: string, k?: any) => void; confirm: any }) {
  const [info, setInfo] = useState<any>(null);
  useEffect(() => {
    api.get('/system/info').then(setInfo).catch(() => {});
  }, []);

  const doAction = async (
    path: string,
    opts: { title: string; message: string; label: string; danger?: boolean; confirmBody?: boolean }
  ) => {
    const ok = await confirm({ title: opts.title, message: opts.message, danger: opts.danger, confirmLabel: opts.label });
    if (!ok) return;
    try {
      await api.post(path, opts.confirmBody ? { confirm: true } : undefined);
      toast('Done', 'success');
    } catch (e: any) {
      toast(e?.message || 'Action failed', 'error');
    }
  };

  return (
    <div className="max-w-lg space-y-5">
      {info && (
        <div className="card p-4 text-sm text-content-soft space-y-1">
          <div><b className="text-content">Host:</b> {info.hostname}</div>
          <div><b className="text-content">Platform:</b> {info.platform} {info.arch}</div>
          <div><b className="text-content">Display:</b> {info.displayBackend}</div>
          <div><b className="text-content">Uptime:</b> {Math.floor(info.uptime / 3600)}h</div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-3">
        <button className="btn-ghost !justify-start"
          onClick={() => doAction('/system/screen/sleep', { title: 'Sleep screen?', message: 'The display will turn off. Touch to wake.', label: 'Sleep screen' })}>
          <MoonStar size={20} /> Sleep screen now
        </button>
        <button className="btn-ghost !justify-start"
          onClick={() => doAction('/system/restart-app', { title: 'Restart app?', message: 'The planner backend service will restart.', label: 'Restart', confirmBody: true })}>
          <RotateCw size={20} /> Restart app
        </button>
        <button className="btn-ghost !justify-start"
          onClick={() => doAction('/system/reboot', { title: 'Reboot the Pi?', message: 'The whole device will restart. This takes a minute.', label: 'Reboot', danger: true, confirmBody: true })}>
          <RotateCw size={20} /> Reboot device
        </button>
        <button className="btn-danger !justify-start"
          onClick={() => doAction('/system/shutdown', { title: 'Shut down the Pi?', message: 'The device will power off and must be turned on manually.', label: 'Shut down', danger: true, confirmBody: true })}>
          <Power size={20} /> Shut down device
        </button>
      </div>
      <p className="text-sm text-content-faint">
        Reboot/shutdown/restore require admin rights (LAN or admin token) and are never exposed publicly.
      </p>
    </div>
  );
}

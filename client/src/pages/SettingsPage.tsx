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
  Users,
  Rss,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Images,
  Star,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useFeedback } from '../components/ui/Feedback';
import { Field, Toggle, ColorPicker } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { MemberAvatar, MemberSelect } from '../components/MemberBadge';
import { useFamily } from '../hooks/useFamily';
import type {
  GoogleStatus,
  GoogleCalendar,
  BackupInfo,
  FamilyMember,
  CalendarSubscription,
} from '../types';

const ACCENTS = [
  { key: 'blush', label: 'Blush', color: '#e382a8' },
  { key: 'lavender', label: 'Lavender', color: '#9580e0' },
  { key: 'sage', label: 'Sage', color: '#6fb291' },
  { key: 'sky', label: 'Sky', color: '#6c9ae8' },
  { key: 'amber', label: 'Amber', color: '#e2a04e' },
];

type Tab =
  | 'general'
  | 'family'
  | 'display'
  | 'appearance'
  | 'calendar'
  | 'calendars'
  | 'weather'
  | 'personal'
  | 'photos'
  | 'google'
  | 'backups'
  | 'system';

export default function SettingsPage() {
  const { get, update } = useSettings();
  const { toast, confirm } = useFeedback();
  const [tab, setTab] = useState<Tab>('general');

  const TABS: { key: Tab; label: string; icon: typeof Monitor }[] = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'family', label: 'Family', icon: Users },
    { key: 'display', label: 'Display', icon: Monitor },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'calendar', label: 'Calendar', icon: CalendarDays },
    { key: 'calendars', label: 'Calendars', icon: Rss },
    { key: 'weather', label: 'Weather', icon: CloudSun },
    { key: 'personal', label: 'Personal', icon: Heart },
    { key: 'photos', label: 'Photos', icon: Images },
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
          {tab === 'family' && <FamilyTab toast={toast} confirm={confirm} />}
          {tab === 'display' && <DisplayTab get={get} update={update} />}
          {tab === 'appearance' && <AppearanceTab get={get} update={update} />}
          {tab === 'calendar' && <CalendarTab get={get} update={update} />}
          {tab === 'calendars' && <CalendarsTab toast={toast} confirm={confirm} />}
          {tab === 'weather' && <WeatherTab get={get} update={update} toast={toast} />}
          {tab === 'personal' && <PersonalTab get={get} update={update} />}
          {tab === 'photos' && <PhotosTab get={get} update={update} toast={toast} confirm={confirm} />}
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

interface PhotoItem {
  name: string;
  url: string;
  size: number;
}

function PhotosTab({
  get,
  update,
  toast,
  confirm,
}: {
  get: GetFn;
  update: UpdateFn;
  toast: (m: string, k?: any) => void;
  confirm: any;
}) {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const homeBg = get<string>('display.homeBackground', '');

  const load = async () => {
    try {
      setPhotos(await api.get<PhotoItem[]>('/photos'));
    } catch {
      toast('Could not load photos', 'error');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const readAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const dataUrl = await readAsDataUrl(file);
        await api.post('/photos', { dataUrl, name: file.name });
        ok++;
      } catch (e: any) {
        toast(e?.message || `Could not upload ${file.name}`, 'error');
      }
    }
    setBusy(false);
    if (ok) toast(`Uploaded ${ok} photo${ok === 1 ? '' : 's'}`, 'success');
    load();
  };

  const remove = async (p: PhotoItem) => {
    const okc = await confirm({
      title: 'Delete photo?',
      message: 'This removes it from the planner permanently.',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!okc) return;
    try {
      await api.del(`/photos/${encodeURIComponent(p.name)}`);
      if (homeBg === p.url) await update({ 'display.homeBackground': '' });
      toast('Deleted', 'success');
      load();
    } catch {
      toast('Could not delete', 'error');
    }
  };

  const setBackground = (url: string) => update({ 'display.homeBackground': url });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-display font-bold text-content mb-1">Photos</h3>
        <p className="text-content-faint">
          Upload photos for the screensaver, Photo Mode, and the home background. They’re stored
          on this device — nothing leaves your home.
        </p>
      </div>

      <label className={`btn-primary inline-flex cursor-pointer ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
        <Upload size={20} /> {busy ? 'Uploading…' : 'Upload photos'}
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-vkeyboard="off"
          onChange={(e) => {
            onFiles(e.target.files);
            e.currentTarget.value = '';
          }}
        />
      </label>

      {/* Home background chooser */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Images size={20} className="text-accent" />
          <h4 className="font-display font-bold text-content">Home screen background</h4>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setBackground('')}
            className={`w-28 h-20 rounded-xl border-2 flex items-center justify-center text-sm font-semibold ${
              homeBg === '' ? 'border-accent text-accent bg-accent-soft' : 'border-line text-content-faint'
            }`}
          >
            None
          </button>
          {photos.map((p) => (
            <button
              key={p.name}
              onClick={() => setBackground(p.url)}
              className={`relative w-28 h-20 rounded-xl overflow-hidden border-2 ${
                homeBg === p.url ? 'border-accent' : 'border-transparent'
              }`}
              title="Use as home background"
            >
              <img src={p.url} alt="" className="w-full h-full object-cover" />
              {homeBg === p.url && (
                <span className="absolute top-1 right-1 bg-accent text-white rounded-full p-1">
                  <Star size={14} fill="currentColor" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Library grid */}
      <div>
        <h4 className="font-display font-bold text-content mb-2">
          Library {photos.length > 0 && <span className="text-content-faint">({photos.length})</span>}
        </h4>
        {photos.length === 0 ? (
          <p className="text-content-faint">No photos yet. Upload some above.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((p) => (
              <div key={p.name} className="relative group rounded-xl overflow-hidden border border-line">
                <img src={p.url} alt={p.name} className="w-full h-32 object-cover" />
                <button
                  onClick={() => remove(p)}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 active:scale-95"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
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

/* ------------------------------- Family --------------------------------- */
const MEMBER_SWATCHES = [
  '#e382a8', '#e2825a', '#f0b866', '#7cc4a4', '#6c9ae8',
  '#9580e0', '#c98bdb', '#5eb0a0', '#e2a04e', '#7aa2f7',
];

interface MemberEdit {
  id?: number;
  name: string;
  color: string;
  emoji: string;
  role: FamilyMember['role'];
  birthday: string;
}

function FamilyTab({ toast, confirm }: { toast: (m: string, k?: any) => void; confirm: any }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [edit, setEdit] = useState<MemberEdit | null>(null);

  const load = async () => {
    try {
      setMembers(await api.get<FamilyMember[]>('/family'));
    } catch {
      toast('Could not load family', 'error');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast('Give them a name', 'error');
    const payload = {
      name: edit.name.trim(),
      color: edit.color,
      emoji: edit.emoji || null,
      role: edit.role,
      birthday: edit.birthday || null,
    };
    try {
      if (edit.id) await api.put(`/family/${edit.id}`, payload);
      else await api.post('/family', payload);
      toast('Saved', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const remove = async (m: FamilyMember) => {
    const ok = await confirm({
      title: `Remove ${m.name}?`,
      message: 'Their events, tasks, and chores become shared (not deleted).',
      danger: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await api.del(`/family/${m.id}`);
    load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const next = [...members];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setMembers(next);
    await api.put('/family/reorder', { order: next.map((m) => m.id) });
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-content-soft">
          Add everyone in the household. Colors tag their events, tasks, and chores across the app.
        </p>
        <button
          className="btn-primary shrink-0"
          onClick={() =>
            setEdit({ name: '', color: MEMBER_SWATCHES[members.length % MEMBER_SWATCHES.length], emoji: '', role: 'child', birthday: '' })
          }
        >
          <Plus size={20} /> Add
        </button>
      </div>

      {members.length === 0 ? (
        <div className="card p-8 text-center text-content-faint">No members yet. Add your first above.</div>
      ) : (
        <ul className="space-y-2">
          {members.map((m, i) => (
            <li key={m.id} className="card p-3 flex items-center gap-3" style={{ borderLeft: `6px solid ${m.color}` }}>
              <MemberAvatar member={m} size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-content">{m.name}</div>
                <div className="text-sm text-content-faint capitalize">{m.role}</div>
              </div>
              <div className="flex items-center gap-1">
                <button className="p-2 text-content-faint disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp size={20} />
                </button>
                <button className="p-2 text-content-faint disabled:opacity-30" disabled={i === members.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown size={20} />
                </button>
                <button className="p-2 text-content-faint" onClick={() => setEdit({ id: m.id, name: m.name, color: m.color, emoji: m.emoji || '', role: m.role, birthday: m.birthday || '' })}>
                  <Pencil size={20} />
                </button>
                <button className="p-2 text-content-faint hover:text-rose-500" onClick={() => remove(m)}>
                  <Trash2 size={20} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit member' : 'Add member'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save</button>
          </>
        }
      >
        {edit && (
          <div>
            <Field label="Name">
              <input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emoji (optional)" hint="Shown as their avatar; else their initial.">
                <input className="input" value={edit.emoji} maxLength={4} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} placeholder="🦊" />
              </Field>
              <Field label="Role">
                <select className="input" data-vkeyboard="off" value={edit.role} onChange={(e) => setEdit({ ...edit, role: e.target.value as FamilyMember['role'] })}>
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                </select>
              </Field>
            </div>
            <Field label="Birthday (optional)">
              <input type="date" data-vkeyboard="off" className="input" value={edit.birthday} onChange={(e) => setEdit({ ...edit, birthday: e.target.value })} />
            </Field>
            <Field label="Color">
              <ColorPicker value={edit.color} onChange={(c) => setEdit({ ...edit, color: c })} swatches={MEMBER_SWATCHES} />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------ Calendars ------------------------------- */
interface SubEdit {
  id?: number;
  name: string;
  url: string;
  color: string;
  member_id: number | null;
  enabled: boolean;
}

function CalendarsTab({ toast, confirm }: { toast: (m: string, k?: any) => void; confirm: any }) {
  const { members } = useFamily();
  const [subs, setSubs] = useState<CalendarSubscription[]>([]);
  const [edit, setEdit] = useState<SubEdit | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setSubs(await api.get<CalendarSubscription[]>('/subscriptions'));
    } catch {
      toast('Could not load subscriptions', 'error');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim() || !edit.url.trim()) return toast('Name and URL are required', 'error');
    const payload = {
      name: edit.name.trim(),
      url: edit.url.trim(),
      color: edit.color,
      member_id: edit.member_id,
      enabled: edit.enabled,
    };
    setBusy(true);
    try {
      if (edit.id) await api.put(`/subscriptions/${edit.id}`, payload);
      else {
        const r = await api.post<{ sync: { error?: string; synced?: number } }>('/subscriptions', payload);
        if (r.sync?.error) toast(`Added, but sync failed: ${r.sync.error}`, 'error');
        else toast(`Added — synced ${r.sync?.synced ?? 0} events`, 'success');
      }
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    } finally {
      setBusy(false);
    }
  };

  const syncOne = async (s: CalendarSubscription) => {
    setBusy(true);
    try {
      const r = await api.post<{ sync: { error?: string; synced?: number } }>(`/subscriptions/${s.id}/sync`);
      if (r.sync?.error) toast(`Sync failed: ${r.sync.error}`, 'error');
      else toast(`Synced ${r.sync?.synced ?? 0} events`, 'success');
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s: CalendarSubscription) => {
    const ok = await confirm({
      title: 'Remove subscription?',
      message: `"${s.name}" and its imported events will be removed.`,
      danger: true,
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    await api.del(`/subscriptions/${s.id}`);
    load();
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-3">
        <p className="text-content-soft">
          Subscribe to any public iCloud, Outlook, or Google <code>.ics</code> link (read-only).
        </p>
        <button
          className="btn-primary shrink-0"
          onClick={() => setEdit({ name: '', url: '', color: '#6c9ae8', member_id: null, enabled: true })}
        >
          <Plus size={20} /> Add
        </button>
      </div>
      <p className="text-sm text-content-faint mb-4">
        See <span className="font-semibold">docs/ics-calendar-setup.md</span> for how to get the secret URL from iCloud and Outlook.
      </p>

      {subs.length === 0 ? (
        <div className="card p-8 text-center text-content-faint">No calendar subscriptions yet.</div>
      ) : (
        <ul className="space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="card p-3 flex items-center gap-3" style={{ borderLeft: `6px solid ${s.color}` }}>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-content flex items-center gap-2">
                  {s.name}
                  {!s.enabled && <span className="chip bg-line text-content-soft">Off</span>}
                </div>
                <div className="text-sm text-content-faint truncate">{s.url}</div>
                {s.last_error ? (
                  <div className="text-sm text-rose-500 mt-0.5">⚠ {s.last_error}</div>
                ) : s.last_synced ? (
                  <div className="text-xs text-content-faint mt-0.5">Last synced {s.last_synced}</div>
                ) : null}
              </div>
              <button className="btn-ghost !py-2 !px-3" disabled={busy} onClick={() => syncOne(s)}>
                <RotateCw size={18} />
              </button>
              <button className="p-2 text-content-faint" onClick={() => setEdit({ id: s.id, name: s.name, url: s.url, color: s.color, member_id: s.member_id ?? null, enabled: !!s.enabled })}>
                <Pencil size={20} />
              </button>
              <button className="p-2 text-content-faint hover:text-rose-500" onClick={() => remove(s)}>
                <Trash2 size={20} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit subscription' : 'Add subscription'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Working…' : 'Save'}</button>
          </>
        }
      >
        {edit && (
          <div>
            <Field label="Name">
              <input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Work · iCloud" />
            </Field>
            <Field label="ICS URL" hint="A public/secret .ics or webcal link.">
              <input className="input" inputMode="url" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://…/calendar.ics" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <ColorPicker value={edit.color} onChange={(c) => setEdit({ ...edit, color: c })} swatches={MEMBER_SWATCHES} />
              </Field>
              <Field label="Owner (optional)">
                <MemberSelect members={members} value={edit.member_id} onChange={(id) => setEdit({ ...edit, member_id: id })} sharedLabel="Household" />
              </Field>
            </div>
            <label className="flex items-center gap-3 mt-2">
              <Toggle checked={edit.enabled} onChange={(v) => setEdit({ ...edit, enabled: v })} label="Enabled" />
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

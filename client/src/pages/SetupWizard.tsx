import { useState } from 'react';
import {
  Heart,
  ChevronRight,
  ChevronLeft,
  Check,
  Monitor,
  Palette,
  MapPin,
  CalendarDays,
  Cloud,
  Sparkles,
} from 'lucide-react';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { Field, Toggle } from '../components/ui/Field';

const ACCENTS = [
  { key: 'blush', color: '#e382a8' },
  { key: 'lavender', color: '#9580e0' },
  { key: 'sage', color: '#6fb291' },
  { key: 'sky', color: '#6c9ae8' },
  { key: 'amber', color: '#e2a04e' },
];

// 8-step first-run wizard. Accumulates settings, then persists on finish.
export function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const { reload } = useSettings();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  const [householdName, setHouseholdName] = useState('Our Home');
  const [theme, setTheme] = useState('auto');
  const [accent, setAccent] = useState('blush');
  const [clock24, setClock24] = useState(false);
  const [weatherLabel, setWeatherLabel] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [personalEnabled, setPersonalEnabled] = useState(true);
  const [partnerA, setPartnerA] = useState('Frank');
  const [partnerB, setPartnerB] = useState('Jessie');
  const [keepDemo, setKeepDemo] = useState(false);

  // Apply theme/accent live as they pick.
  const applyPreview = (t: string, a: string) => {
    const html = document.documentElement;
    html.setAttribute('data-accent', a);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.classList.toggle('dark', t === 'dark' || (t === 'auto' && prefersDark));
  };

  const finish = async () => {
    setBusy(true);
    try {
      if (personalEnabled) {
        await api.put('/personal/config', {
          enabled: true,
          partner_a: partnerA || 'Partner A',
          partner_b: partnerB || 'Partner B',
        });
      } else {
        await api.put('/personal/config', { enabled: false });
      }
      await api.post('/setup/complete', {
        keepDemoData: keepDemo,
        settings: {
          'general.householdName': householdName,
          'display.theme': theme,
          'display.accent': accent,
          'display.clock24h': clock24,
          'weather.label': weatherLabel || null,
          'weather.lat': lat ? Number(lat) : null,
          'weather.lon': lon ? Number(lon) : null,
          'personal.enabled': personalEnabled,
          'general.firstRunComplete': true,
        },
      });
      await reload();
      onComplete();
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    {
      icon: Heart,
      title: 'Welcome',
      body: (
        <div className="text-center">
          <Heart size={64} className="text-accent mx-auto mb-4" fill="currentColor" />
          <p className="text-xl text-content-soft">
            Let’s set up your wall planner. It only takes a minute — you can change
            everything later in Settings.
          </p>
        </div>
      ),
    },
    {
      icon: Monitor,
      title: 'Name your home',
      body: (
        <Field label="Household name" hint="Shown on the dashboard.">
          <input className="input text-xl" value={householdName} autoFocus
            onChange={(e) => setHouseholdName(e.target.value)} />
        </Field>
      ),
    },
    {
      icon: Palette,
      title: 'Pick a look',
      body: (
        <div className="space-y-6">
          <Field label="Theme">
            <div className="flex gap-2">
              {['light', 'dark', 'auto'].map((t) => (
                <button key={t} className={`btn flex-1 ${theme === t ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setTheme(t); applyPreview(t, accent); }}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Accent color">
            <div className="flex gap-3">
              {ACCENTS.map((a) => (
                <button key={a.key} onClick={() => { setAccent(a.key); applyPreview(theme, a.key); }}
                  className={`w-14 h-14 rounded-full shadow-soft ${accent === a.key ? 'scale-110' : ''}`}
                  style={{ backgroundColor: a.color, outline: accent === a.key ? '3px solid rgb(var(--accent))' : 'none', outlineOffset: 3 }} />
              ))}
            </div>
          </Field>
        </div>
      ),
    },
    {
      icon: CalendarDays,
      title: 'Clock style',
      body: (
        <Toggle checked={clock24} onChange={setClock24} label="Use a 24-hour clock" />
      ),
    },
    {
      icon: MapPin,
      title: 'Weather location',
      body: (
        <div className="space-y-3">
          <p className="text-content-soft">
            Optional — set where you are for local weather. (Provider &amp; API key live in
            <code> .env</code>.)
          </p>
          <Field label="Location label">
            <input className="input" value={weatherLabel} placeholder="New York, NY"
              onChange={(e) => setWeatherLabel(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude">
              <input className="input" data-vkeyboard="off" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
            </Field>
            <Field label="Longitude">
              <input className="input" data-vkeyboard="off" inputMode="decimal" value={lon} onChange={(e) => setLon(e.target.value)} />
            </Field>
          </div>
        </div>
      ),
    },
    {
      icon: Heart,
      title: 'Personal section',
      body: (
        <div className="space-y-4">
          <Toggle checked={personalEnabled} onChange={setPersonalEnabled}
            label="Enable the “Us” couples section" />
          {personalEnabled && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name 1">
                <input className="input" value={partnerA} onChange={(e) => setPartnerA(e.target.value)} />
              </Field>
              <Field label="Name 2">
                <input className="input" value={partnerB} onChange={(e) => setPartnerB(e.target.value)} />
              </Field>
            </div>
          )}
        </div>
      ),
    },
    {
      icon: Cloud,
      title: 'Google Calendar',
      body: (
        <div className="text-content-soft space-y-2">
          <p>
            You can connect Google Calendar later from{' '}
            <span className="font-semibold text-content">Settings → Google</span> once you’ve
            added your OAuth credentials to <code>.env</code>.
          </p>
          <p className="text-sm">See <b>docs/google-calendar-setup.md</b> for the steps.</p>
        </div>
      ),
    },
    {
      icon: Sparkles,
      title: 'Demo data',
      body: (
        <div className="space-y-4">
          <p className="text-content-soft">
            We loaded some example events, tasks and classes so the planner looks alive.
            Keep them to explore, or start fresh.
          </p>
          <Toggle checked={keepDemo} onChange={setKeepDemo} label="Keep the demo data for now" />
          <p className="text-sm text-content-faint">
            You can always clear or re-seed demo data from Settings.
          </p>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="h-full flex items-center justify-center bg-surface p-6">
      <div className="card w-full max-w-2xl p-8 animate-fade-up">
        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center mb-6">
          {steps.map((_, i) => (
            <span key={i}
              className={`h-2 rounded-full transition-all ${i === step ? 'w-8 bg-accent' : i < step ? 'w-2 bg-accent/50' : 'w-2 bg-line'}`} />
          ))}
        </div>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-accent-soft flex items-center justify-center text-accent-ink">
            <current.icon size={26} />
          </div>
          <h1 className="text-2xl font-display font-bold text-content">{current.title}</h1>
          <span className="ml-auto text-sm text-content-faint">
            Step {step + 1} of {steps.length}
          </span>
        </div>

        <div className="min-h-[16rem] flex flex-col justify-center">{current.body}</div>

        <div className="flex justify-between mt-6">
          <button className="btn-ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft size={20} /> Back
          </button>
          {isLast ? (
            <button className="btn-primary" disabled={busy} onClick={finish}>
              <Check size={20} /> {busy ? 'Finishing…' : 'Finish setup'}
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

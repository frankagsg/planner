import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Settings } from '../../types';
import { Download, Upload, Palette as PaletteIcon, Check, RotateCcw } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { Field } from '../ui/Field';
import { useFeedback } from '../ui/Feedback';
import { api } from '../../lib/api';
import { PlannerBackground } from './PlannerBackground';
import {
  DEFAULT_APPEARANCE, BUILTIN_THEMES, appearanceTokens, contrastRatio,
  normalizeAppearance, parseThemeFile, readAppearance, readPresets,
  type Appearance, type Palette, type ThemePreset,
} from '../../lib/appearance';

interface Photo { name: string; url: string }
const FONT_OPTIONS = [['rounded', 'Rounded'], ['system', 'Clean / system'], ['serif', 'Classic / serif']];
const DRAFT_KEY = 'wp:appearance-draft:v1';
function restoredDraft(settings: Settings) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (saved?.base === JSON.stringify(readAppearance(settings)) && saved?.presetBase === JSON.stringify(readPresets(settings['display.themePresets']))) {
      return { appearance: normalizeAppearance(saved.appearance), presets: readPresets(saved.presets) };
    }
  } catch { /* A disabled or full browser store does not prevent editing. */ }
  return null;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (value: string) => void }) {
  return <Field label={label}><select className="input" data-vkeyboard="off" value={value} onChange={e => onChange(e.target.value)}>
    {options.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
  </select></Field>;
}
function Slider({ label, value, min, max, unit = '', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <Field label={`${label} · ${value}${unit}`}><input type="range" aria-label={label} min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} /></Field>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [hex, setHex] = useState(value);
  useEffect(() => setHex(value), [value]);
  const invalid = !/^#[a-f\d]{6}$/i.test(hex);
  return <Field label={label}><div className="flex gap-2 items-center">
    <input type="color" aria-label={label} value={value} onChange={e => onChange(e.target.value)} />
    <input className="input min-w-0" aria-label={`${label} hex`} data-vkeyboard="off" value={hex} maxLength={7}
      aria-invalid={invalid} onChange={e => { setHex(e.target.value); if (/^#[a-f\d]{6}$/i.test(e.target.value)) onChange(e.target.value); }} onBlur={() => setHex(value)} />
  </div></Field>;
}

export default function AppearanceEditor() {
  const { settings, save } = useSettings();
  const { toast } = useFeedback();
  const [draft, setDraft] = useState(() => restoredDraft(settings)?.appearance || readAppearance(settings));
  const [presets, setPresets] = useState(() => restoredDraft(settings)?.presets || readPresets(settings['display.themePresets']));
  const committed = useRef(readAppearance(settings));
  const committedPresets = useRef(readPresets(settings['display.themePresets']));
  const [previous, setPrevious] = useState<Appearance | null>(null);
  const [editingPalette, setEditingPalette] = useState<'light' | 'dark'>(draft.mode === 'dark' ? 'dark' : 'light');
  const [presetName, setPresetName] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoError, setPhotoError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(readAppearance(settings)) || JSON.stringify(presets) !== JSON.stringify(readPresets(settings['display.themePresets']));
  useEffect(() => {
    const next = readAppearance(settings), nextPresets = readPresets(settings['display.themePresets']);
    const before = committed.current, beforePresets = committedPresets.current;
    setDraft(current => JSON.stringify(current) === JSON.stringify(before) ? next : current);
    setPresets(current => JSON.stringify(current) === JSON.stringify(beforePresets) ? nextPresets : current);
    committed.current = next; committedPresets.current = nextPresets;
  }, [settings]);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ base: JSON.stringify(readAppearance(settings)), presetBase: JSON.stringify(readPresets(settings['display.themePresets'])), appearance: draft, presets }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch { /* Editing and server persistence still work without browser storage. */ }
  }, [draft, presets, settings, dirty]);
  const loadPhotos = async () => {
    try { setPhotos(await api.get<Photo[]>('/photos')); setPhotoError(''); }
    catch { setPhotoError('The photo library could not be loaded.'); }
  };
  useEffect(() => { void loadPhotos(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function change<K extends keyof Appearance>(key: K, value: Appearance[K]) { setDraft(a => ({ ...a, [key]: value })); setStatus(''); }
  function background(patch: Partial<Appearance['background']>) { setDraft(a => ({ ...a, background: { ...a.background, ...patch } })); setStatus(''); }
  function setColor(key: keyof Palette, value: string) { setDraft(a => ({ ...a, [editingPalette]: { ...a[editingPalette], [key]: value } })); setStatus(''); }
  function choose(a: Appearance) { setDraft(normalizeAppearance(a)); setEditingPalette(a.mode === 'dark' ? 'dark' : 'light'); setError(''); setStatus(''); }
  const apply = async () => {
    if (draft.mode === 'schedule' && draft.dayStart === draft.nightStart) { setError('Choose different day and night start times.'); return; }
    if (['photo', 'slideshow'].includes(draft.background.kind) && !draft.background.photos.length) { setError('Choose a photo for this background first.'); return; }
    setBusy(true); setError('');
    try {
      const before = readAppearance(settings);
      await save({ 'display.appearance': normalizeAppearance(draft), 'display.themePresets': presets });
      setPrevious(before); setStatus('Appearance saved to your planner.'); toast('Appearance saved', 'success');
    } catch { setError('Could not save to the planner. Your draft is still here; reconnect and try again.'); }
    finally { setBusy(false); }
  };
  const discard = () => { choose(readAppearance(settings)); setPresets(readPresets(settings['display.themePresets'])); setStatus('Draft discarded.'); };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) { setError('Give your preset a name first.'); return; }
    if (presets.length >= 20) { setError('You can keep 20 presets. Remove one before adding another.'); return; }
    setPresets(p => [...p, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, appearance: normalizeAppearance(draft) }]);
    setPresetName(''); setError(''); setStatus('Preset added to draft. Apply appearance to save it.');
  };
  const exportTheme = () => {
    const file = new Blob([JSON.stringify({ format: 'wall-planner-theme', version: 1, appearance: draft }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = 'planner-theme.json'; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importTheme = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 100_000) throw new Error('Theme file is too large.');
      choose(parseThemeFile(await file.text())); setStatus('Theme imported into preview. Apply when ready.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not import this theme.'); }
  };
  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true); setError('');
    const added: Photo[] = [];
    try {
      for (const file of files) {
        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Use JPG, PNG, WebP, or GIF photos.');
        if (file.size > 10 * 1024 * 1024) throw new Error('Choose photos smaller than 10 MB each.');
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read photo.')); reader.readAsDataURL(file);
        });
        added.push(await api.post<Photo>('/photos', { dataUrl, name: file.name }));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Photo upload failed.'); }
    finally {
      if (added.length) {
        setPhotos(p => [...added, ...p]);
        setDraft(a => ({ ...a, background: { ...a.background, kind: added.length > 1 ? 'slideshow' : 'photo', photos: added.map(p => p.url).slice(0, 40) } }));
        setStatus(`${added.length} photo(s) uploaded to the library. Apply to use this background.`);
      }
      setUploading(false);
    }
  };
  const togglePhoto = (url: string) => {
    if (draft.background.kind === 'photo') background({ photos: [url] });
    else background({ photos: draft.background.photos.includes(url) ? draft.background.photos.filter(p => p !== url) : [...draft.background.photos, url].slice(0, 40) });
  };
  const palette = draft[editingPalette];
  const lowContrast = contrastRatio(palette.text, palette.card) < 4.5 || contrastRatio(palette.muted, palette.card) < 4.5;
  const photoMode = ['photo', 'slideshow'].includes(draft.background.kind);
  const missingPhotos = draft.background.photos.filter(url => !photos.some(p => p.url === url));
  const presetButton = (preset: ThemePreset) => {
    const p = preset.appearance.mode === 'dark' ? preset.appearance.dark : preset.appearance.light;
    return <button key={preset.id} type="button" className="appearance-preset" onClick={() => choose(preset.appearance)} aria-label={`Preview ${preset.name} theme`}
      style={{ background: p.background, color: p.text }}>
      <div className="flex gap-1 px-3 pt-3">{[p.accent, p.card, p.muted].map((c, i) => <span key={i} className="w-6 h-6 rounded-full border border-black/10" style={{ background: c }} />)}</div>
      <span className="block px-3 py-2 font-bold break-words">{preset.name}</span>
    </button>;
  };

  return <div className="appearance-editor space-y-5">
    <div><h2 className="font-display text-2xl font-bold flex items-center gap-2"><PaletteIcon className="text-accent" /> Make it yours</h2>
      <p className="text-content-soft mt-1">Start with a theme, then make every color and background your own. Changes stay in preview until you apply them.</p></div>
    <fieldset disabled={busy || uploading} className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">{BUILTIN_THEMES.map(presetButton)}</div>
      <div className="flex gap-2 items-center flex-wrap"><span className="text-sm font-bold text-content-soft mr-auto">PREVIEW · sample content</span>
        {(['light', 'dark'] as const).map(p => <button key={p} type="button" className={editingPalette === p ? 'btn-soft' : 'btn-ghost'} aria-pressed={editingPalette === p} onClick={() => setEditingPalette(p)}>{p === 'light' ? 'Light palette' : 'Dark palette'}</button>)}
      </div>
      <div className="appearance-preview" style={{ ...appearanceTokens(draft, editingPalette === 'dark'), fontSize: `${draft.textScale}%` } as CSSProperties}>
        <PlannerBackground appearance={draft} />
        <div className="font-display font-bold mb-4" style={{ fontSize: '1.6em' }}>A little more you.</div>
        <div className="preview-grid">
          <div className="card"><div className="font-display font-bold" style={{ fontSize: '2.2em' }}>8:30 AM</div><p className="text-content-soft">A fresh start for your day</p><span className="inline-block mt-3 rounded-full px-3 py-1 bg-accent-soft text-accent-ink">Our home</span></div>
          <div className="card"><div className="font-display font-bold mb-3">Today</div><p className="text-content-soft">Family dinner · 6:00 PM</p><div className="mt-4 inline-flex items-center gap-2 rounded-xl p-2 bg-accent" style={{ color: 'rgb(var(--accent-label))' }}><Check size={18} /> Ready for the day</div></div>
        </div>
      </div>
      {lowContrast && <p className="text-content-soft text-sm" role="status">Some text colors have low contrast against the card color. Try darker text on light cards or lighter text on dark cards.</p>}

      <section className="appearance-section"><h3 className="text-xl font-display font-bold mb-4">Theme &amp; colors</h3>
        <Select label="Theme mode" value={draft.mode} options={[[ 'auto', 'Follow device' ], ['light', 'Always light'], ['dark', 'Always dark'], ['schedule', 'Day / night schedule']]}
          onChange={v => change('mode', v as Appearance['mode'])} />
        {draft.mode === 'schedule' && <div className="appearance-controls"><Field label="Light theme starts"><input className="input" type="time" value={draft.dayStart} onChange={e => change('dayStart', e.target.value)} /></Field><Field label="Dark theme starts"><input className="input" type="time" value={draft.nightStart} onChange={e => change('nightStart', e.target.value)} /></Field></div>}
        <p className="text-content-soft mb-3">Editing the <b>{editingPalette}</b> palette. Use the palette buttons above to customize the other one.</p>
        <div className="appearance-controls">{([['accent', 'Accent'], ['background', 'Page color'], ['card', 'Card color'], ['text', 'Main text'], ['muted', 'Secondary text'], ['border', 'Borders']] as [keyof Palette, string][]).map(([key, label]) => <Color key={key} label={label} value={palette[key]} onChange={v => setColor(key, v)} />)}</div>
      </section>

      <section className="appearance-section"><h3 className="text-xl font-display font-bold mb-4">Background</h3>
        <div className="appearance-controls"><Select label="Background style" value={draft.background.kind} options={[[ 'none', 'Theme color' ], ['solid', 'Solid color'], ['gradient', 'Gradient'], ['photo', 'Photo'], ['slideshow', 'Photo slideshow']]}
          onChange={v => background({ kind: v as Appearance['background']['kind'], ...(v === 'photo' ? { photos: draft.background.photos.slice(0, 1) } : {}) })} />
          <Select label="Show background on" value={draft.background.scope} options={[[ 'home', 'Home screen' ], ['all', 'Every page']]}
            onChange={v => background({ scope: v as 'home' | 'all' })} />
        </div>
        {draft.background.kind !== 'none' && <>
          <div className="appearance-controls"><Color label={photoMode ? 'Photo backdrop' : 'Background color'} value={draft.background.color} onChange={color => background({ color })} />
            {draft.background.kind === 'gradient' && <Color label="Gradient end color" value={draft.background.colorEnd} onChange={colorEnd => background({ colorEnd })} />}</div>
          {draft.background.kind === 'gradient' && <Slider label="Gradient angle" value={draft.background.angle} min={0} max={360} unit="°" onChange={angle => background({ angle })} />}
          {photoMode && <div className="space-y-3 mb-5">
            <label className="btn-ghost cursor-pointer"><Upload size={18} /> {uploading ? 'Uploading…' : 'Upload background photos'}
              <input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple data-vkeyboard="off" onChange={e => { void upload(Array.from(e.target.files || [])); e.currentTarget.value = ''; }} /></label>
            <p className="text-sm text-content-soft">Uploads go to your planner’s photo library immediately, even if you discard the theme. JPG, PNG, WebP or GIF, up to 10 MB each.</p>
            {photoError && <p role="alert">{photoError} <button className="btn-ghost" onClick={loadPhotos}>Retry photos</button></p>}
            {!photoError && !photos.length && <p className="text-content-soft">Upload your first photo to get started.</p>}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{photos.map(p => <button type="button" key={p.url} aria-label={`Select photo ${p.name}`} aria-pressed={draft.background.photos.includes(p.url)} onClick={() => togglePhoto(p.url)} className={`relative rounded-xl overflow-hidden border-4 ${draft.background.photos.includes(p.url) ? 'border-accent' : 'border-transparent'}`}>
              <img src={p.url} alt={p.name} className="h-24 w-full object-cover" />{draft.background.photos.includes(p.url) && <span className="absolute right-1 top-1 bg-black/70 text-white p-1 rounded-full"><Check size={18} /></span>}</button>)}</div>
            {!!missingPhotos.length && <p className="text-content-soft">{missingPhotos.length} selected photo(s) are unavailable in this library. Choose local photos or <button className="underline" onClick={() => background({ photos: draft.background.photos.filter(p => !missingPhotos.includes(p)) })}>remove unavailable photos</button>.</p>}
            <p className="text-sm text-content-soft">{draft.background.photos.length} selected{draft.background.kind === 'slideshow' ? ' · plays in selection order · up to 40 photos' : ''}</p>
            <div className="appearance-controls"><Select label="Photo fit" value={draft.background.fit} options={[[ 'cover', 'Fill screen (crop)' ], ['contain', 'Show whole photo']]}
              onChange={v => background({ fit: v as 'cover' | 'contain' })} />
              {draft.background.kind === 'slideshow' && <Field label="Seconds per photo"><input className="input" type="number" min={15} max={3600} data-vkeyboard="off" value={draft.background.interval} onChange={e => background({ interval: Math.max(15, Math.min(3600, Number(e.target.value) || 15)) })} /></Field>}</div>
            <div className="appearance-controls"><Slider label="Horizontal position" value={draft.background.x} min={0} max={100} unit="%" onChange={x => background({ x })} /><Slider label="Vertical position" value={draft.background.y} min={0} max={100} unit="%" onChange={y => background({ y })} /></div>
          </div>}
          <div className="appearance-controls"><Slider label="Background dimming" value={draft.background.dim} min={0} max={90} unit="%" onChange={dim => background({ dim })} /><Slider label="Background blur" value={draft.background.blur} min={0} max={20} unit="px" onChange={blur => background({ blur })} /></div>
        </>}
      </section>

      <section className="appearance-section"><h3 className="text-xl font-display font-bold mb-4">Type &amp; cards</h3><div className="appearance-controls">
        <Select label="Body font" value={draft.font} options={FONT_OPTIONS} onChange={v => change('font', v as Appearance['font'])} />
        <Select label="Heading font" value={draft.headingFont} options={FONT_OPTIONS} onChange={v => change('headingFont', v as Appearance['font'])} />
        <Slider label="Text size" value={draft.textScale} min={90} max={125} unit="%" onChange={v => change('textScale', v)} />
        <Slider label="Card opacity" value={draft.cardOpacity} min={25} max={100} unit="%" onChange={v => change('cardOpacity', v)} />
        <Slider label="Rounded corners" value={draft.cardRadius} min={0} max={40} unit="px" onChange={v => change('cardRadius', v)} />
        <Slider label="Border width" value={draft.cardBorder} min={0} max={4} unit="px" onChange={v => change('cardBorder', v)} />
        <Select label="Card shadow" value={draft.cardShadow} options={[[ 'none', 'None' ], ['soft', 'Soft'], ['strong', 'Strong']]} onChange={v => change('cardShadow', v as Appearance['cardShadow'])} />
        <Select label="Home card spacing" value={draft.spacing} options={[[ 'compact', 'Compact' ], ['comfortable', 'Comfortable'], ['spacious', 'Spacious']]} onChange={v => change('spacing', v as Appearance['spacing'])} />
      </div></section>

      <section className="appearance-section"><h3 className="text-xl font-display font-bold mb-2">Your saved looks</h3><p className="text-content-soft mb-4">Keep up to 20 presets. Export a theme to reuse its style on another planner; photo files are managed separately.</p>
        <div className="flex flex-wrap gap-3 items-end"><div className="flex-1 min-w-0"><Field label="Preset name"><input className="input" value={presetName} maxLength={40} onChange={e => setPresetName(e.target.value)} placeholder="Sunday morning" /></Field></div><button className="btn-ghost mb-4" onClick={savePreset}>Add preset</button></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{presets.map(p => <div key={p.id} className="grid gap-1">{presetButton(p)}<button className="btn-ghost text-sm" onClick={() => setPresets(all => all.filter(x => x.id !== p.id))}>Remove {p.name}</button></div>)}</div>
        <div className="flex flex-wrap gap-2 mt-4"><button className="btn-ghost" onClick={exportTheme}><Download size={18} /> Export theme</button>
          <label className="btn-ghost cursor-pointer"><Upload size={18} /> Import theme<input className="hidden" type="file" accept="application/json,.json" onChange={e => { void importTheme(e.target.files?.[0]); e.currentTarget.value = ''; }} /></label>
          <button className="btn-ghost" onClick={() => choose(DEFAULT_APPEARANCE)}><RotateCcw size={18} /> Preview defaults</button>
        </div>
      </section>
    </fieldset>
    {error && <p role="alert" className="p-3 rounded-xl bg-rose-100 text-rose-900">{error}</p>}
    {status && <p role="status" className="text-content-soft">{status}</p>}
    <div className="appearance-actions">
      <span className="text-sm text-content-soft mr-auto">{dirty ? 'Unsaved preview' : 'Up to date'}</span>
      {previous && <button className="btn-ghost" disabled={busy || uploading} onClick={() => { choose(previous); setStatus('Previous appearance loaded into preview. Apply to restore it.'); }}>Previous look</button>}
      <button className="btn-ghost" disabled={!dirty || busy || uploading} onClick={discard}>Discard</button>
      <button className="btn-primary" disabled={!dirty || busy || uploading} onClick={apply}>{busy ? 'Saving…' : 'Apply appearance'}</button>
    </div>
  </div>;
}

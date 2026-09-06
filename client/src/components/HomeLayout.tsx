import { useState, type ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, EyeOff, GripVertical, SlidersHorizontal } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useFeedback } from './ui/Feedback';
import { HOME_WIDGETS, defaultHomeLayout, normalizeHomeLayout, moveHomeWidget, resizeHomeColumns } from '../lib/homeLayout';
import type { HomeLayoutValue, HomeWidgetId } from '../lib/homeLayout';

export function HomeLayout({ widgets }: { widgets: Record<HomeWidgetId, ReactNode> }) {
  const { get, save, ready } = useSettings();
  const { toast } = useFeedback();
  const [draft, setDraft] = useState<HomeLayoutValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState<HomeWidgetId | null>(null);
  const layout = draft || normalizeHomeLayout(get('home.layout'));
  const editing = draft !== null;
  const move = (id: HomeWidgetId, column: number, position: number) => {
    setDraft(previous => previous ? moveHomeWidget(previous, id, column, position) : previous);
  };
  const persist = async () => {
    if (!draft) return;
    setSaving(true);
    try { await save({ 'home.layout': draft }); setDraft(null); toast('Home layout saved', 'success'); }
    catch { toast('Could not save the layout. Your changes are still here—try again.', 'error'); }
    finally { setSaving(false); }
  };
  const visible = layout.columns.flat().filter(id => !layout.hidden.includes(id) && widgets[id]);
  const grid = layout.columns.length === 1 ? 'grid-cols-1' : layout.columns.length === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-3';
  return <>
    <div className="mb-5">
      {!editing ? <div className="flex justify-end">
        <button className="btn-ghost" disabled={!ready} onClick={() => setDraft(normalizeHomeLayout(get('home.layout')))}>
          <SlidersHorizontal size={20} /> Customize home
        </button>
      </div> : <fieldset disabled={saving} className="card p-4 min-w-0">
        <legend className="sr-only">Customize home widgets</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-display font-bold">Customize home</h2>
            <p className="text-sm text-content-soft">Move widgets with the arrows or drag their handles. Hide any you don’t need.</p>
            <p className="text-sm text-content-faint">Save to apply this layout on all your planner screens.</p></div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => setDraft(defaultHomeLayout())}>Reset layout</button>
            <button className="btn-ghost" onClick={() => { setDraft(null); setDragged(null); }}>Cancel</button>
            <button className="btn-primary" onClick={persist}>{saving ? 'Saving…' : 'Save layout'}</button>
          </div>
        </div>
        <label className="flex items-center gap-3 mt-3 text-sm font-semibold">Columns on wide screens
          <select className="input !w-auto" value={layout.columns.length} onChange={event => setDraft(resizeHomeColumns(layout, Number(event.target.value)))}>
            <option value={1}>1 column</option><option value={2}>2 columns</option><option value={3}>3 columns</option>
          </select>
        </label>
        {layout.hidden.length > 0 && <div className="mt-4">
          <h3 className="text-sm font-semibold mb-2">Hidden widgets</h3>
          <div className="flex flex-wrap gap-2">{layout.hidden.map(id => <button key={id} className="btn-ghost !py-2"
            onClick={() => setDraft({ ...layout, hidden: layout.hidden.filter(item => item !== id) })}>Show {HOME_WIDGETS[id]}</button>)}</div>
        </div>}
      </fieldset>}
    </div>
    {!editing && visible.length === 0 && <div className="card p-6 text-content-soft">No widgets are showing. Use Customize home to bring them back.</div>}
    <div className={`grid ${grid} gap-5 items-start`}>
      {layout.columns.map((column, columnIndex) => <div key={columnIndex} className={`space-y-5 min-w-0 ${editing ? 'rounded-2xl border border-dashed border-line p-3 min-h-32' : ''}`}
        onDragOver={event => { if (editing && dragged && !saving) event.preventDefault(); }}
        onDrop={event => { event.preventDefault(); if (dragged && !saving) move(dragged, columnIndex, column.length); setDragged(null); }}>
        {editing && <h3 className="text-sm font-semibold text-content-soft">Column {columnIndex + 1}</h3>}
        {column.filter(id => !layout.hidden.includes(id)).map(id => {
          if (!editing && !widgets[id]) return null;
          const index = column.indexOf(id);
          const available = column.filter(item => !layout.hidden.includes(item));
          const visibleIndex = available.indexOf(id);
          const toolbarButton = 'btn-ghost !p-2 min-h-[44px] min-w-[44px]';
          return <section key={id} aria-label={`${HOME_WIDGETS[id]} widget`} className="min-w-0"
            onDragOver={event => { if (editing && dragged && !saving) event.preventDefault(); }}
            onDrop={event => { if (!dragged || saving) return; event.preventDefault(); event.stopPropagation();
              if (dragged !== id) move(dragged, columnIndex, column.filter(item => item !== dragged).indexOf(id)); setDragged(null); }}>
            {editing && <fieldset disabled={saving} className="rounded-t-xl bg-surface p-2 border border-line min-w-0">
              <legend className="sr-only">Edit {HOME_WIDGETS[id]} widget</legend>
              <div className="flex flex-wrap items-center gap-1">
                <button className={toolbarButton} aria-label={`Drag ${HOME_WIDGETS[id]}`} draggable={!saving}
                  onDragStart={event => { setDragged(id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }}
                  onDragEnd={() => setDragged(null)}><GripVertical size={18} /></button>
                <span className="font-semibold text-sm flex-1">{HOME_WIDGETS[id]}</span>
                <button className={toolbarButton} aria-label={`Hide ${HOME_WIDGETS[id]}`} onClick={() => setDraft({ ...layout, hidden: [...layout.hidden, id] })}><EyeOff size={18} /></button>
              </div>
              <div className="flex flex-wrap gap-1">
                <button className={toolbarButton} aria-label={`Move ${HOME_WIDGETS[id]} up`} disabled={visibleIndex === 0} onClick={() => move(id, columnIndex, column.indexOf(available[visibleIndex - 1]))}><ArrowUp size={18} /></button>
                <button className={toolbarButton} aria-label={`Move ${HOME_WIDGETS[id]} down`} disabled={visibleIndex === available.length - 1} onClick={() => move(id, columnIndex, column.indexOf(available[visibleIndex + 1]))}><ArrowDown size={18} /></button>
                <button className={toolbarButton} aria-label={`Move ${HOME_WIDGETS[id]} to previous column`} disabled={columnIndex === 0} onClick={() => move(id, columnIndex - 1, index)}><ArrowLeft size={18} /></button>
                <button className={toolbarButton} aria-label={`Move ${HOME_WIDGETS[id]} to next column`} disabled={columnIndex === layout.columns.length - 1} onClick={() => move(id, columnIndex + 1, index)}><ArrowRight size={18} /></button>
              </div>
            </fieldset>}
            {widgets[id] || <div className="card p-4 text-sm text-content-faint">{HOME_WIDGETS[id]} will appear when it has content and is enabled in Settings.</div>}
          </section>;
        })}
        {editing && column.every(id => layout.hidden.includes(id)) && <p className="text-sm text-content-faint">Move a widget into this column.</p>}
      </div>)}
    </div>
  </>;
}

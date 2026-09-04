import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Check,
  Trash2,
  BookOpen,
  FlaskConical,
  Stethoscope,
  NotebookPen,
  FileText,
  GraduationCap,
} from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field, ColorPicker } from '../components/ui/Field';
import type { SchoolClass, SchoolItem, SchoolKind, SchoolSummary } from '../types';
import { toLocalInput, fromLocalInput, countdownLabel, daysUntil } from '../lib/dates';

const KIND_META: Record<SchoolKind, { label: string; icon: typeof BookOpen }> = {
  assignment: { label: 'Assignment', icon: FileText },
  exam: { label: 'Exam', icon: FlaskConical },
  clinical: { label: 'Clinical', icon: Stethoscope },
  study: { label: 'Study', icon: NotebookPen },
  reading: { label: 'Reading', icon: BookOpen },
  project: { label: 'Project', icon: NotebookPen },
};

type Filter = 'all' | 'today' | 'tomorrow' | 'week' | 'overdue';

interface ItemEdit {
  id?: number;
  class_id: number | null;
  title: string;
  kind: SchoolKind;
  due: string;
  notes: string;
}
interface ClassEdit {
  id?: number;
  name: string;
  code: string;
  instructor: string;
  color: string;
  term: string;
  schedule: string;
}

export default function SchoolPage() {
  const { toast, confirm } = useFeedback();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [summary, setSummary] = useState<SchoolSummary | null>(null);
  const [filter, setFilter] = useState<Filter>('week');
  const [itemEdit, setItemEdit] = useState<ItemEdit | null>(null);
  const [classEdit, setClassEdit] = useState<ClassEdit | null>(null);
  const [justDone, setJustDone] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [cls, its, sum] = await Promise.all([
        api.get<SchoolClass[]>('/school/classes', true),
        api.get<SchoolItem[]>(`/school/items?filter=${filter}`, true),
        api.get<SchoolSummary>('/school/summary', true),
      ]);
      setClasses(cls);
      setItems(its);
      setSummary(sum);
    } catch {
      toast('Could not load school data', 'error');
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (it: SchoolItem) => {
    if (!it.completed) {
      setJustDone(it.id);
      setTimeout(() => setJustDone(null), 500);
    }
    await api.post(`/school/items/${it.id}/toggle`);
    setTimeout(load, it.completed ? 0 : 350);
  };

  const saveItem = async () => {
    if (!itemEdit) return;
    if (!itemEdit.title.trim()) return toast('Give it a title', 'error');
    const payload = {
      class_id: itemEdit.class_id,
      title: itemEdit.title.trim(),
      kind: itemEdit.kind,
      due: itemEdit.due ? fromLocalInput(itemEdit.due) : null,
      notes: itemEdit.notes || null,
    };
    try {
      if (itemEdit.id) await api.put(`/school/items/${itemEdit.id}`, payload);
      else await api.post('/school/items', payload);
      setItemEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const saveClass = async () => {
    if (!classEdit) return;
    if (!classEdit.name.trim()) return toast('Name the class', 'error');
    const payload = {
      name: classEdit.name.trim(),
      code: classEdit.code || null,
      instructor: classEdit.instructor || null,
      color: classEdit.color,
      term: classEdit.term || null,
      schedule: classEdit.schedule || null,
    };
    try {
      if (classEdit.id) await api.put(`/school/classes/${classEdit.id}`, payload);
      else await api.post('/school/classes', payload);
      setClassEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const removeItem = async (it: SchoolItem) => {
    const ok = await confirm({ title: 'Delete item?', danger: true, confirmLabel: 'Delete' });
    if (!ok) return;
    await api.del(`/school/items/${it.id}`);
    load();
  };

  const removeClass = async (c: SchoolClass) => {
    const ok = await confirm({
      title: 'Delete class?',
      message: 'Its assignments and exams will also be removed.',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/school/classes/${c.id}`);
    load();
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Due today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'week', label: 'This week' },
    { key: 'overdue', label: 'Catch up' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold text-content flex items-center gap-2">
          <GraduationCap className="text-accent" /> School
        </h1>
        <div className="flex gap-2">
          <button
            className="btn-ghost"
            onClick={() =>
              setClassEdit({
                name: '',
                code: '',
                instructor: '',
                color: '#7cc4a4',
                term: '',
                schedule: '',
              })
            }
          >
            <Plus size={20} /> Class
          </button>
          <button
            className="btn-primary"
            onClick={() =>
              setItemEdit({
                class_id: classes[0]?.id ?? null,
                title: '',
                kind: 'assignment',
                due: '',
                notes: '',
              })
            }
          >
            <Plus size={22} /> Assignment
          </button>
        </div>
      </div>

      {/* Friendly progress summary — encouraging, not alarming */}
      {summary && (
        <div className="card p-5 mb-5 bg-accent-soft/50">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="text-2xl font-display font-bold text-accent-ink">
              {summary.remaining} remaining
            </span>
            {summary.dueToday > 0 && (
              <span className="chip bg-white/70 text-accent-ink">
                {summary.dueToday} due today
              </span>
            )}
            {summary.dueThisWeek > 0 && (
              <span className="chip bg-white/70 text-content-soft">
                {summary.dueThisWeek} this week
              </span>
            )}
            {summary.overdue > 0 && (
              <span className="chip bg-amber-100 text-amber-700">
                {summary.overdue} to catch up — you’ve got this 💪
              </span>
            )}
            {summary.completed > 0 && (
              <span className="chip bg-emerald-100 text-emerald-700">
                {summary.completed} done
              </span>
            )}
          </div>
        </div>
      )}

      {/* Classes strip */}
      {classes.length > 0 && (
        <div className="flex gap-3 overflow-x-auto no-scrollbar mb-5 pb-1">
          {classes.map((c) => (
            <button
              key={c.id}
              onClick={() =>
                setClassEdit({
                  id: c.id,
                  name: c.name,
                  code: c.code || '',
                  instructor: c.instructor || '',
                  color: c.color,
                  term: c.term || '',
                  schedule: c.schedule || '',
                })
              }
              className="card px-4 py-3 min-w-[12rem] text-left shrink-0"
              style={{ borderLeftColor: c.color, borderLeftWidth: 5 }}
            >
              <div className="font-bold text-content line-clamp-1">{c.name}</div>
              <div className="text-sm text-content-faint">
                {c.code} {c.schedule ? `· ${c.schedule}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn !py-2.5 ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Items */}
      {items.length === 0 ? (
        <div className="card p-10 text-center text-content-faint text-lg">
          Nothing here for this filter. Nice and clear. ✨
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const Meta = KIND_META[it.kind] || KIND_META.assignment;
            const days = it.due ? daysUntil(it.due) : null;
            const overdue = days != null && days < 0 && !it.completed;
            return (
              <li
                key={it.id}
                className={`card p-4 flex items-center gap-4 ${it.completed ? 'opacity-60' : ''}`}
                style={{ borderLeftColor: it.class_color || undefined, borderLeftWidth: it.class_color ? 5 : undefined }}
              >
                <button
                  onClick={() => toggle(it)}
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition
                    ${it.completed ? 'bg-accent border-accent text-white' : 'border-line text-transparent hover:border-accent'}
                    ${justDone === it.id ? 'animate-check-pop' : ''}`}
                  aria-label="Toggle complete"
                >
                  <Check size={22} strokeWidth={3} />
                </button>

                <button className="flex-1 text-left" onClick={() => setItemEdit({
                  id: it.id,
                  class_id: it.class_id ?? null,
                  title: it.title,
                  kind: it.kind,
                  due: it.due ? toLocalInput(new Date(it.due)) : '',
                  notes: it.notes || '',
                })}>
                  <div className="flex items-center gap-2">
                    <Meta.icon size={18} className="text-content-soft" />
                    <span className={`text-lg font-semibold text-content ${it.completed ? 'line-through' : ''}`}>
                      {it.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm mt-0.5">
                    {it.class_name && (
                      <span className="text-content-faint">{it.class_name}</span>
                    )}
                    {it.due && (
                      <span className={overdue ? 'text-amber-600 font-semibold' : 'text-content-faint'}>
                        {format(new Date(it.due), 'EEE MMM d')} · {countdownLabel(it.due)}
                      </span>
                    )}
                  </div>
                </button>

                <button
                  className="text-content-faint hover:text-rose-500 p-2"
                  onClick={() => removeItem(it)}
                  aria-label="Delete"
                >
                  <Trash2 size={22} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Item modal */}
      <Modal
        open={!!itemEdit}
        onClose={() => setItemEdit(null)}
        title={itemEdit?.id ? 'Edit item' : 'New item'}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setItemEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveItem}>Save</button>
          </>
        }
      >
        {itemEdit && (
          <div>
            <Field label="Title">
              <input
                className="input"
                autoFocus
                value={itemEdit.title}
                onChange={(e) => setItemEdit({ ...itemEdit, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <select
                  className="input"
                  data-vkeyboard="off"
                  value={itemEdit.kind}
                  onChange={(e) => setItemEdit({ ...itemEdit, kind: e.target.value as SchoolKind })}
                >
                  {Object.entries(KIND_META).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Class">
                <select
                  className="input"
                  data-vkeyboard="off"
                  value={itemEdit.class_id ?? ''}
                  onChange={(e) =>
                    setItemEdit({ ...itemEdit, class_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">None</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Due">
              <input
                type="datetime-local"
                data-vkeyboard="off"
                className="input"
                value={itemEdit.due}
                onChange={(e) => setItemEdit({ ...itemEdit, due: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="input min-h-[5rem]"
                value={itemEdit.notes}
                onChange={(e) => setItemEdit({ ...itemEdit, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      {/* Class modal */}
      <Modal
        open={!!classEdit}
        onClose={() => setClassEdit(null)}
        title={classEdit?.id ? 'Edit class' : 'New class'}
        footer={
          <>
            {classEdit?.id && (
              <button
                className="btn-danger mr-auto"
                onClick={() => {
                  const c = classes.find((x) => x.id === classEdit.id);
                  if (c) removeClass(c);
                  setClassEdit(null);
                }}
              >
                <Trash2 size={20} /> Delete
              </button>
            )}
            <button className="btn-ghost" onClick={() => setClassEdit(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveClass}>Save</button>
          </>
        }
      >
        {classEdit && (
          <div>
            <Field label="Name">
              <input
                className="input"
                autoFocus
                value={classEdit.name}
                onChange={(e) => setClassEdit({ ...classEdit, name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code">
                <input
                  className="input"
                  value={classEdit.code}
                  onChange={(e) => setClassEdit({ ...classEdit, code: e.target.value })}
                />
              </Field>
              <Field label="Term">
                <input
                  className="input"
                  value={classEdit.term}
                  onChange={(e) => setClassEdit({ ...classEdit, term: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Instructor">
              <input
                className="input"
                value={classEdit.instructor}
                onChange={(e) => setClassEdit({ ...classEdit, instructor: e.target.value })}
              />
            </Field>
            <Field label="Schedule">
              <input
                className="input"
                placeholder="Mon/Wed 9–11am"
                value={classEdit.schedule}
                onChange={(e) => setClassEdit({ ...classEdit, schedule: e.target.value })}
              />
            </Field>
            <Field label="Color">
              <ColorPicker
                value={classEdit.color}
                onChange={(color) => setClassEdit({ ...classEdit, color })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

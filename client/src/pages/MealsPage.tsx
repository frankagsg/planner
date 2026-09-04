import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink, ShoppingCart } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import { MemberSelect } from '../components/MemberBadge';
import { useFamily } from '../hooks/useFamily';
import type { Meal, MealSlot, MealWeek } from '../types';

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

interface EditState {
  id?: number;
  date: string;
  slot: MealSlot;
  title: string;
  notes: string;
  recipe_url: string;
  member_id: number | null;
}

export default function MealsPage() {
  const { toast, confirm } = useFeedback();
  const { members } = useFamily();
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<MealWeek | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const refDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d.toISOString().slice(0, 10);
  })();

  const load = useCallback(async () => {
    try {
      setData(await api.get<MealWeek>(`/meals/week?ref=${refDate}`, true));
    } catch {
      toast('Could not load meals', 'error');
    }
  }, [refDate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const mealAt = (date: string, slot: MealSlot) =>
    (data?.meals || []).filter((m) => m.date === date && m.slot === slot);

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast('Give the meal a name', 'error');
    const payload = {
      date: edit.date,
      slot: edit.slot,
      title: edit.title.trim(),
      notes: edit.notes || null,
      recipe_url: edit.recipe_url || null,
      member_id: edit.member_id,
    };
    try {
      if (edit.id) await api.put(`/meals/${edit.id}`, payload);
      else await api.post('/meals', payload);
      toast('Saved', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const remove = async () => {
    if (!edit?.id) return;
    const ok = await confirm({
      title: 'Delete meal?',
      message: `"${edit.title}" will be removed.`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/meals/${edit.id}`);
    setEdit(null);
    load();
  };

  // Push this meal's notes (one ingredient per line) onto the grocery list.
  const addIngredients = async () => {
    if (!edit) return;
    const items = edit.notes
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (items.length === 0) {
      return toast('Add ingredients (one per line) in Notes first', 'info');
    }
    try {
      const r = await api.post<{ added: unknown[] }>('/meals/add-ingredients', { items });
      toast(`Added ${r.added.length} item${r.added.length === 1 ? '' : 's'} to Groceries 🛒`, 'success');
    } catch {
      toast('Could not add to list', 'error');
    }
  };

  const openNew = (date: string, slot: MealSlot) =>
    setEdit({ date, slot, title: '', notes: '', recipe_url: '', member_id: null });
  const openEdit = (m: Meal) =>
    setEdit({
      id: m.id,
      date: m.date,
      slot: m.slot,
      title: m.title,
      notes: m.notes || '',
      recipe_url: m.recipe_url || '',
      member_id: m.member_id ?? null,
    });

  const dates = data?.dates || [];

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold text-content">Meals</h1>
        <div className="flex items-center gap-2">
          <button className="btn-ghost !px-3" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft size={22} />
          </button>
          <button
            className={`btn ${weekOffset === 0 ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setWeekOffset(0)}
          >
            This week
          </button>
          <button className="btn-ghost !px-3" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight size={22} />
          </button>
        </div>
      </div>

      <div className="card p-3 overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `7rem repeat(${dates.length}, minmax(9rem, 1fr))` }}>
          {/* Header row */}
          <div />
          {dates.map((d) => {
            const dt = new Date(d + 'T00:00:00');
            const isToday = d === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={d}
                className={`text-center py-2 rounded-xl ${isToday ? 'bg-accent-soft text-accent-ink' : 'text-content-soft'}`}
              >
                <div className="font-bold">{format(dt, 'EEE')}</div>
                <div className="text-sm">{format(dt, 'MMM d')}</div>
              </div>
            );
          })}

          {/* Slot rows */}
          {SLOTS.map((slot) => (
            <SlotRow
              key={slot}
              slot={slot}
              label={SLOT_LABEL[slot]}
              dates={dates}
              mealAt={mealAt}
              onAdd={openNew}
              onOpen={openEdit}
            />
          ))}
        </div>
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit meal' : 'Add meal'}
        footer={
          <>
            {edit?.id && (
              <button className="btn-danger mr-auto" onClick={remove}>
                <Trash2 size={20} /> Delete
              </button>
            )}
            <button className="btn-ghost" onClick={() => setEdit(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save}>
              Save
            </button>
          </>
        }
      >
        {edit && (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Day">
                <input
                  type="date"
                  data-vkeyboard="off"
                  className="input"
                  value={edit.date}
                  onChange={(e) => setEdit({ ...edit, date: e.target.value })}
                />
              </Field>
              <Field label="Meal">
                <select
                  className="input"
                  data-vkeyboard="off"
                  value={edit.slot}
                  onChange={(e) => setEdit({ ...edit, slot: e.target.value as MealSlot })}
                >
                  {SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {SLOT_LABEL[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="What's cooking?">
              <input
                className="input"
                autoFocus
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <Field label="For (optional)">
              <MemberSelect
                members={members}
                value={edit.member_id}
                onChange={(id) => setEdit({ ...edit, member_id: id })}
              />
            </Field>
            <Field label="Ingredients / notes" hint="One ingredient per line to add them to the grocery list.">
              <textarea
                className="input min-h-[6rem]"
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </Field>
            <Field label="Recipe link (optional)">
              <input
                className="input"
                inputMode="url"
                value={edit.recipe_url}
                onChange={(e) => setEdit({ ...edit, recipe_url: e.target.value })}
              />
            </Field>
            <div className="flex gap-2 flex-wrap">
              <button className="btn-soft" onClick={addIngredients}>
                <ShoppingCart size={20} /> Add ingredients to Groceries
              </button>
              {edit.recipe_url && (
                <a
                  className="btn-ghost"
                  href={edit.recipe_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={20} /> Open recipe
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function SlotRow({
  slot,
  label,
  dates,
  mealAt,
  onAdd,
  onOpen,
}: {
  slot: MealSlot;
  label: string;
  dates: string[];
  mealAt: (d: string, s: MealSlot) => Meal[];
  onAdd: (d: string, s: MealSlot) => void;
  onOpen: (m: Meal) => void;
}) {
  return (
    <>
      <div className="flex items-center font-bold text-content-soft text-sm">{label}</div>
      {dates.map((d) => {
        const meals = mealAt(d, slot);
        return (
          <div key={d + slot} className="min-h-[4.5rem] flex flex-col gap-1">
            {meals.map((m) => (
              <button
                key={m.id}
                onClick={() => onOpen(m)}
                className="text-left rounded-xl bg-surface-raised border border-line px-3 py-2 hover:bg-accent-soft transition flex-1"
              >
                <div className="font-semibold text-content text-sm line-clamp-2">{m.title}</div>
              </button>
            ))}
            <button
              onClick={() => onAdd(d, slot)}
              className="rounded-xl border-2 border-dashed border-line text-content-faint py-2 hover:border-accent hover:text-accent transition flex items-center justify-center"
              aria-label={`Add ${label}`}
            >
              <Plus size={18} />
            </button>
          </div>
        );
      })}
    </>
  );
}

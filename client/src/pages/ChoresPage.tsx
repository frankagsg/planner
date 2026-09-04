import { useCallback, useEffect, useState } from 'react';
import { Plus, Check, Trash2, Trophy, Star, Pencil, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import { MemberFilter, MemberAvatar, MemberSelect } from '../components/MemberBadge';
import { useFamily } from '../hooks/useFamily';
import type {
  ChoreToday,
  ChoreRecurrence,
  Leaderboard,
  Chore,
} from '../types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface EditState {
  id?: number;
  title: string;
  member_id: number | null;
  points: number;
  recurrence: ChoreRecurrence;
  days_of_week: number;
  notes: string;
  active: boolean;
}
const empty = (): EditState => ({
  title: '',
  member_id: null,
  points: 5,
  recurrence: 'daily',
  days_of_week: 0,
  notes: '',
  active: true,
});

export default function ChoresPage() {
  const { toast, confirm } = useFeedback();
  const { members, byId } = useFamily();
  const [today, setToday] = useState<ChoreToday[]>([]);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [justDone, setJustDone] = useState<number | null>(null);
  const [manage, setManage] = useState(false);
  const [allChores, setAllChores] = useState<Chore[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, lb] = await Promise.all([
        api.get<{ date: string; chores: ChoreToday[] }>('/chores/today', true),
        api.get<Leaderboard>('/chores/leaderboard', true),
      ]);
      setToday(t.chores);
      setBoard(lb);
      if (manage) setAllChores(await api.get<Chore[]>('/chores'));
    } catch {
      toast('Could not load chores', 'error');
    }
  }, [toast, manage]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = today.filter((c) => filter === null || c.member_id === filter);

  const complete = async (c: ChoreToday) => {
    if (!c.done) {
      setJustDone(c.id);
      setTimeout(() => setJustDone(null), 600);
    }
    try {
      if (c.done) await api.post(`/chores/${c.id}/undo`);
      else await api.post(`/chores/${c.id}/complete`);
      setTimeout(load, c.done ? 0 : 400);
    } catch {
      toast('Could not update', 'error');
    }
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast('Give the chore a name', 'error');
    const payload = {
      title: edit.title.trim(),
      member_id: edit.member_id,
      points: edit.points,
      recurrence: edit.recurrence,
      days_of_week: edit.recurrence === 'specific-days' || edit.recurrence === 'weekly'
        ? edit.days_of_week
        : 0,
      notes: edit.notes || null,
      active: edit.active,
    };
    try {
      if (edit.id) await api.put(`/chores/${edit.id}`, payload);
      else await api.post('/chores', payload);
      toast('Saved', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const remove = async (c: Chore) => {
    const ok = await confirm({
      title: 'Delete chore?',
      message: `"${c.title}" and its history will be removed.`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/chores/${c.id}`);
    load();
  };

  const openEdit = (c: Chore) =>
    setEdit({
      id: c.id,
      title: c.title,
      member_id: c.member_id ?? null,
      points: c.points,
      recurrence: c.recurrence,
      days_of_week: c.days_of_week,
      notes: c.notes || '',
      active: !!c.active,
    });

  const toggleDay = (bit: number) =>
    edit && setEdit({ ...edit, days_of_week: edit.days_of_week ^ (1 << bit) });

  const ranked = [...(board?.board || [])].sort((a, b) => b.weekPoints - a.weekPoints);
  const doneCount = visible.filter((c) => c.done).length;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-3xl font-display font-bold text-content flex items-center gap-2">
          <Sparkles className="text-accent" /> Chores
        </h1>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setManage((m) => !m)}>
            <Pencil size={20} /> {manage ? 'Done' : 'Manage'}
          </button>
          <button className="btn-primary" onClick={() => setEdit(empty())}>
            <Plus size={22} /> New chore
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Today's chores */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <MemberFilter members={members} value={filter} onChange={setFilter} />
            {visible.length > 0 && (
              <span className="chip bg-accent-soft text-accent-ink">
                {doneCount}/{visible.length} done today
              </span>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="card p-10 text-center text-content-faint text-lg">
              {members.length === 0
                ? 'Add family members in Settings → Family, then create chores.'
                : 'No chores today. Nice and easy. 🌱'}
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((c) => {
                const m = byId(c.member_id);
                return (
                  <li
                    key={c.id}
                    className={`card p-4 flex items-center gap-4 transition ${
                      c.done ? 'opacity-70' : ''
                    }`}
                    style={m ? { borderLeft: `6px solid ${m.color}` } : undefined}
                  >
                    <button
                      onClick={() => complete(c)}
                      className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 transition
                        ${
                          c.done
                            ? 'bg-accent border-accent text-white'
                            : 'border-line text-transparent hover:border-accent'
                        } ${justDone === c.id ? 'animate-check-pop' : ''}`}
                      aria-label={c.done ? 'Undo' : 'Mark done'}
                    >
                      <Check size={30} strokeWidth={3} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xl font-semibold text-content ${
                          c.done ? 'line-through' : ''
                        }`}
                      >
                        {c.title}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-content-faint mt-0.5">
                        {m && (
                          <span className="flex items-center gap-1.5">
                            <MemberAvatar member={m} size={22} /> {m.name}
                          </span>
                        )}
                        <span className="chip bg-amber-100 text-amber-700">
                          <Star size={13} fill="currentColor" /> {c.points} pts
                        </span>
                      </div>
                    </div>
                    {manage && (
                      <>
                        <button className="text-content-faint p-2" onClick={() => openEdit(c)}>
                          <Pencil size={20} />
                        </button>
                        <button
                          className="text-content-faint hover:text-rose-500 p-2"
                          onClick={() => remove(c)}
                        >
                          <Trash2 size={20} />
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {manage && allChores.length > 0 && (
            <div className="card p-4">
              <h3 className="font-display font-bold text-content mb-2">All chores</h3>
              <ul className="space-y-2">
                {allChores.map((c) => {
                  const m = byId(c.member_id);
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-1">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: m?.color || 'rgb(var(--content-faint))' }}
                      />
                      <span className="flex-1 text-content font-semibold">{c.title}</span>
                      <span className="text-sm text-content-faint">{c.recurrence}</span>
                      <button className="p-1.5 text-content-faint" onClick={() => openEdit(c)}>
                        <Pencil size={18} />
                      </button>
                      <button
                        className="p-1.5 text-content-faint hover:text-rose-500"
                        onClick={() => remove(c)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-xl font-display font-bold text-content flex items-center gap-2 mb-4">
              <Trophy className="text-amber-500" /> Leaderboard
            </h2>
            {ranked.length === 0 ? (
              <p className="text-content-faint">Add members to start earning points.</p>
            ) : (
              <ul className="space-y-3">
                {ranked.map((entry, i) => (
                  <li key={entry.member.id} className="flex items-center gap-3">
                    <span className="text-lg font-bold w-6 text-center text-content-faint">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <MemberAvatar member={entry.member} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-content">{entry.member.name}</div>
                      <div className="text-xs text-content-faint">
                        {entry.allTimePoints} all-time
                      </div>
                    </div>
                    <span className="text-2xl font-display font-bold text-accent-ink tabular-nums">
                      {entry.weekPoints}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-content-faint mt-4">Points earned this week. Great job, team! 🌟</p>
          </div>
        </div>
      </div>

      {/* Editor */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit chore' : 'New chore'}
        footer={
          <>
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
            <Field label="What needs doing?">
              <input
                className="input"
                autoFocus
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Who">
                <MemberSelect
                  members={members}
                  value={edit.member_id}
                  onChange={(id) => setEdit({ ...edit, member_id: id })}
                />
              </Field>
              <Field label="Points">
                <input
                  type="number"
                  data-vkeyboard="off"
                  className="input"
                  min={0}
                  value={edit.points}
                  onChange={(e) => setEdit({ ...edit, points: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Repeats">
              <select
                className="input"
                data-vkeyboard="off"
                value={edit.recurrence}
                onChange={(e) =>
                  setEdit({ ...edit, recurrence: e.target.value as ChoreRecurrence })
                }
              >
                <option value="none">Just once</option>
                <option value="daily">Every day</option>
                <option value="weekly">Weekly (pick days)</option>
                <option value="specific-days">Specific days</option>
              </select>
            </Field>
            {(edit.recurrence === 'weekly' || edit.recurrence === 'specific-days') && (
              <Field label="On these days">
                <div className="flex gap-1.5 flex-wrap">
                  {DOW.map((d, i) => {
                    const on = (edit.days_of_week & (1 << i)) !== 0;
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={`w-12 h-12 rounded-full font-bold transition ${
                          on ? 'bg-accent text-white' : 'bg-surface-raised text-content border border-line'
                        }`}
                      >
                        {d[0]}
                      </button>
                    );
                  })}
                </div>
              </Field>
            )}
            <Field label="Notes">
              <textarea
                className="input min-h-[4rem]"
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

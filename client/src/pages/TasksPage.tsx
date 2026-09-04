import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Check, Trash2, Flag } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import type { Task, Category } from '../types';
import { toLocalInput, fromLocalInput } from '../lib/dates';

type Filter = 'today' | 'upcoming' | 'completed';

interface EditState {
  id?: number;
  title: string;
  notes: string;
  due: string;
  priority: Task['priority'];
  category_id: number | null;
}

const empty = (): EditState => ({
  title: '',
  notes: '',
  due: '',
  priority: 'normal',
  category_id: null,
});

const PRIORITY_COLOR: Record<Task['priority'], string> = {
  low: 'text-content-faint',
  normal: 'text-accent',
  high: 'text-rose-500',
};

export default function TasksPage() {
  const { toast, confirm } = useFeedback();
  const [filter, setFilter] = useState<Filter>('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [justDone, setJustDone] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([
        api.get<Task[]>(`/tasks?filter=${filter === 'completed' ? 'completed' : filter}`, true),
        api.get<Category[]>('/categories', true),
      ]);
      setTasks(t);
      setCategories(c);
    } catch {
      toast('Could not load tasks', 'error');
    }
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (task: Task) => {
    // Optimistic + gentle completion animation.
    if (!task.completed) {
      setJustDone(task.id);
      setTimeout(() => setJustDone(null), 500);
    }
    try {
      await api.post(`/tasks/${task.id}/toggle`);
      setTimeout(load, task.completed ? 0 : 350);
    } catch {
      toast('Could not update', 'error');
    }
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast('Give the task a name', 'error');
    const payload = {
      title: edit.title.trim(),
      notes: edit.notes || null,
      due: edit.due ? fromLocalInput(edit.due) : null,
      priority: edit.priority,
      category_id: edit.category_id,
    };
    try {
      if (edit.id) await api.put(`/tasks/${edit.id}`, payload);
      else await api.post('/tasks', payload);
      toast('Saved', 'success');
      setEdit(null);
      load();
    } catch (e: any) {
      toast(e?.message || 'Could not save', 'error');
    }
  };

  const remove = async (task: Task) => {
    const ok = await confirm({
      title: 'Delete task?',
      message: `"${task.title}" will be removed.`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/tasks/${task.id}`);
    load();
  };

  const openEdit = (task: Task) =>
    setEdit({
      id: task.id,
      title: task.title,
      notes: task.notes || '',
      due: task.due ? toLocalInput(new Date(task.due)) : '',
      priority: task.priority,
      category_id: task.category_id ?? null,
    });

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-display font-bold text-content">Tasks</h1>
        <button className="btn-primary" onClick={() => setEdit(empty())}>
          <Plus size={22} /> New task
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-ghost'} !py-2.5`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="card p-10 text-center text-content-faint text-lg">
          {filter === 'completed'
            ? 'Nothing completed yet.'
            : filter === 'today'
            ? 'No tasks for today. Enjoy the breather. ☕'
            : 'No upcoming tasks.'}
        </div>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li
              key={t.id}
              className={`card p-4 flex items-center gap-4 transition ${
                t.completed ? 'opacity-60' : ''
              }`}
            >
              <button
                onClick={() => toggle(t)}
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 transition
                  ${
                    t.completed
                      ? 'bg-accent border-accent text-white'
                      : 'border-line text-transparent hover:border-accent'
                  } ${justDone === t.id ? 'animate-check-pop' : ''}`}
                aria-label={t.completed ? 'Mark incomplete' : 'Mark complete'}
              >
                <Check size={22} strokeWidth={3} />
              </button>

              <button className="flex-1 text-left" onClick={() => openEdit(t)}>
                <div
                  className={`text-lg font-semibold text-content ${
                    t.completed ? 'line-through' : ''
                  }`}
                >
                  {t.title}
                </div>
                <div className="flex items-center gap-3 text-sm text-content-faint mt-0.5">
                  {t.due && <span>{format(new Date(t.due), 'EEE MMM d, h:mm a')}</span>}
                  {t.priority !== 'normal' && (
                    <span className={`flex items-center gap-1 ${PRIORITY_COLOR[t.priority]}`}>
                      <Flag size={13} /> {t.priority}
                    </span>
                  )}
                </div>
              </button>

              <button
                className="text-content-faint hover:text-rose-500 p-2"
                onClick={() => remove(t)}
                aria-label="Delete task"
              >
                <Trash2 size={22} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit task' : 'New task'}
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
            <Field label="Name">
              <input
                className="input"
                autoFocus
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Due">
                <input
                  type="datetime-local"
                  data-vkeyboard="off"
                  className="input"
                  value={edit.due}
                  onChange={(e) => setEdit({ ...edit, due: e.target.value })}
                />
              </Field>
              <Field label="Priority">
                <select
                  className="input"
                  data-vkeyboard="off"
                  value={edit.priority}
                  onChange={(e) =>
                    setEdit({ ...edit, priority: e.target.value as Task['priority'] })
                  }
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </Field>
            </div>
            <Field label="Category">
              <select
                className="input"
                data-vkeyboard="off"
                value={edit.category_id ?? ''}
                onChange={(e) =>
                  setEdit({
                    ...edit,
                    category_id: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Notes">
              <textarea
                className="input min-h-[5rem]"
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

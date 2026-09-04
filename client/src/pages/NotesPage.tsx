import { useEffect, useState, useCallback } from 'react';
import { Plus, Pin, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field, ColorPicker, NOTE_SWATCHES } from '../components/ui/Field';
import type { Note } from '../types';

interface EditState {
  id?: number;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
}

const empty = (): EditState => ({
  title: '',
  body: '',
  color: '#fff7ed',
  pinned: false,
});

export default function NotesPage() {
  const { toast, confirm } = useFeedback();
  const [notes, setNotes] = useState<Note[]>([]);
  const [edit, setEdit] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    try {
      setNotes(await api.get<Note[]>('/notes', true));
    } catch {
      toast('Could not load notes', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!edit) return;
    if (!edit.body.trim() && !edit.title.trim())
      return toast('Write something first', 'error');
    const payload = {
      title: edit.title || null,
      body: edit.body,
      color: edit.color,
      pinned: edit.pinned,
    };
    try {
      if (edit.id) await api.put(`/notes/${edit.id}`, payload);
      else await api.post('/notes', payload);
      setEdit(null);
      load();
    } catch {
      toast('Could not save', 'error');
    }
  };

  const togglePin = async (n: Note) => {
    await api.put(`/notes/${n.id}`, { pinned: !n.pinned });
    load();
  };

  const remove = async (n: Note) => {
    const ok = await confirm({
      title: 'Delete note?',
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await api.del(`/notes/${n.id}`);
    load();
  };

  return (
    <div className="p-6 max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-display font-bold text-content">Notes</h1>
        <button className="btn-primary" onClick={() => setEdit(empty())}>
          <Plus size={22} /> New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="card p-10 text-center text-content-faint text-lg">
          No notes yet. Tap “New note” to jot something down.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {notes.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl p-4 shadow-soft border border-line/40 flex flex-col min-h-[10rem] cursor-pointer active:scale-[0.99] transition"
              style={{ backgroundColor: n.color }}
              onClick={() =>
                setEdit({
                  id: n.id,
                  title: n.title || '',
                  body: n.body,
                  color: n.color,
                  pinned: !!n.pinned,
                })
              }
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold text-lg text-stone-800 line-clamp-1">
                  {n.title || 'Note'}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(n);
                  }}
                  className={n.pinned ? 'text-accent-ink' : 'text-stone-400'}
                  aria-label="Pin note"
                >
                  <Pin size={20} fill={n.pinned ? 'currentColor' : 'none'} />
                </button>
              </div>
              <p className="text-stone-700 mt-2 flex-1 whitespace-pre-wrap line-clamp-6">
                {n.body}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  remove(n);
                }}
                className="self-end text-stone-400 hover:text-rose-500 mt-2"
                aria-label="Delete note"
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit note' : 'New note'}
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
            <Field label="Title (optional)">
              <input
                className="input"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <Field label="Note">
              <textarea
                className="input min-h-[8rem]"
                autoFocus
                value={edit.body}
                onChange={(e) => setEdit({ ...edit, body: e.target.value })}
              />
            </Field>
            <Field label="Color">
              <ColorPicker
                value={edit.color}
                swatches={NOTE_SWATCHES}
                onChange={(color) => setEdit({ ...edit, color })}
              />
            </Field>
            <label className="flex items-center gap-3 mt-2">
              <input
                type="checkbox"
                className="w-6 h-6 accent-[rgb(var(--accent))]"
                checked={edit.pinned}
                onChange={(e) => setEdit({ ...edit, pinned: e.target.checked })}
              />
              <span className="text-lg text-content">Pin to top</span>
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}

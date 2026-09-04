import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Heart, Plus, Trash2, Pencil, CalendarHeart } from 'lucide-react';
import { api } from '../lib/api';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import type { PersonalPayload } from '../types';
import { relative, daysUntil, toLocalInput, fromLocalInput } from '../lib/dates';

export default function PersonalPage() {
  const { toast, confirm } = useFeedback();
  const [data, setData] = useState<PersonalPayload | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [editMsg, setEditMsg] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [dateNote, setDateNote] = useState('');
  const [newEvent, setNewEvent] = useState<{ title: string; at: string; note: string } | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const d = await api.get<PersonalPayload>('/personal', true);
      setData(d);
      setMsgDraft(d.config.message || '');
      setDateDraft(d.config.next_date_at ? toLocalInput(new Date(d.config.next_date_at)) : '');
      setDateNote(d.config.next_date_note || '');
    } catch {
      toast('Could not load', 'error');
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Rotate photos.
  useEffect(() => {
    const photos = data?.photos ?? [];
    if (photos.length < 2) return;
    const interval = (data?.config.photo_interval ?? 8) * 1000;
    const t = setInterval(() => setPhotoIdx((i) => (i + 1) % photos.length), interval);
    return () => clearInterval(t);
  }, [data]);

  const saveConfig = async (patch: Record<string, unknown>) => {
    try {
      await api.put('/personal/config', patch);
      load();
    } catch {
      toast('Could not save', 'error');
    }
  };

  const addEvent = async () => {
    if (!newEvent?.title.trim() || !newEvent.at) return toast('Title and date needed', 'error');
    await api.post('/personal/events', {
      title: newEvent.title.trim(),
      at: fromLocalInput(newEvent.at),
      note: newEvent.note || null,
    });
    setNewEvent(null);
    load();
  };

  const removeEvent = async (id: number) => {
    const ok = await confirm({ title: 'Remove event?', danger: true, confirmLabel: 'Remove' });
    if (!ok) return;
    await api.del(`/personal/events/${id}`);
    load();
  };

  if (!data) return <div className="p-6 text-content-soft">Loading…</div>;

  const { config, events, photos } = data;
  const nextDateDays = config.next_date_at ? daysUntil(config.next_date_at) : null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <h1 className="text-3xl font-display font-bold text-content flex items-center gap-2 mb-5">
        <Heart className="text-accent" fill="currentColor" /> {config.partner_a} &amp;{' '}
        {config.partner_b}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Photo + message */}
        <div className="card overflow-hidden flex flex-col">
          <div className="relative h-72 bg-accent-soft">
            {photos.length > 0 ? (
              photos.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    i === photoIdx ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-accent-ink/70">
                <Heart size={48} fill="currentColor" />
                <p className="mt-2 text-sm">
                  Add photos to <code>client/public/photos/</code>
                </p>
              </div>
            )}
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xl italic text-content">
                “{config.message || 'Add a sweet message'}”
              </p>
              <button
                className="text-content-faint hover:text-accent p-1"
                onClick={() => setEditMsg(true)}
                aria-label="Edit message"
              >
                <Pencil size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Next date + countdown */}
        <div className="card p-6 flex flex-col">
          <h2 className="text-xl font-display font-bold text-content flex items-center gap-2 mb-3">
            <CalendarHeart className="text-accent" /> Next date
          </h2>
          {config.next_date_at ? (
            <div className="text-center py-4">
              <div className="text-6xl font-display font-bold text-accent-ink tabular-nums">
                {nextDateDays === 0 ? 'Today' : nextDateDays}
              </div>
              {nextDateDays !== 0 && (
                <div className="text-content-faint">days to go</div>
              )}
              <div className="text-lg text-content mt-3 font-semibold">
                {format(new Date(config.next_date_at), "EEEE, MMM d 'at' h:mm a")}
              </div>
              {config.next_date_note && (
                <div className="text-content-soft mt-1">{config.next_date_note}</div>
              )}
              <div className="text-sm text-content-faint mt-1">
                {relative(config.next_date_at)}
              </div>
            </div>
          ) : (
            <p className="text-content-faint py-6 text-center">No date planned yet.</p>
          )}

          <div className="mt-auto pt-4 border-t border-line">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date &amp; time">
                <input
                  type="datetime-local"
                  data-vkeyboard="off"
                  className="input"
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                />
              </Field>
              <Field label="Note">
                <input
                  className="input"
                  value={dateNote}
                  onChange={(e) => setDateNote(e.target.value)}
                />
              </Field>
            </div>
            <button
              className="btn-primary w-full"
              onClick={() =>
                saveConfig({
                  next_date_at: dateDraft ? fromLocalInput(dateDraft) : null,
                  next_date_note: dateNote || null,
                })
              }
            >
              Save date
            </button>
          </div>
        </div>
      </div>

      {/* Shared events */}
      <div className="card p-6 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-display font-bold text-content">Shared events</h2>
          <button
            className="btn-soft"
            onClick={() => setNewEvent({ title: '', at: toLocalInput(new Date()), note: '' })}
          >
            <Plus size={20} /> Add
          </button>
        </div>
        {events.length === 0 ? (
          <p className="text-content-faint">No shared events yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 border-b border-line/60 last:border-0">
                <Heart size={18} className="text-accent shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-content">{e.title}</div>
                  <div className="text-sm text-content-faint">
                    {format(new Date(e.at), 'EEE MMM d, h:mm a')}
                    {e.note ? ` · ${e.note}` : ''}
                  </div>
                </div>
                <button
                  className="text-content-faint hover:text-rose-500 p-1"
                  onClick={() => removeEvent(e.id)}
                  aria-label="Remove"
                >
                  <Trash2 size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit message modal */}
      <Modal
        open={editMsg}
        onClose={() => setEditMsg(false)}
        title="Personal message"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditMsg(false)}>Cancel</button>
            <button
              className="btn-primary"
              onClick={() => {
                saveConfig({ message: msgDraft });
                setEditMsg(false);
              }}
            >
              Save
            </button>
          </>
        }
      >
        <Field label="Message shown on the dashboard">
          <textarea
            className="input min-h-[5rem]"
            autoFocus
            value={msgDraft}
            onChange={(e) => setMsgDraft(e.target.value)}
          />
        </Field>
      </Modal>

      {/* New shared event modal */}
      <Modal
        open={!!newEvent}
        onClose={() => setNewEvent(null)}
        title="Add shared event"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setNewEvent(null)}>Cancel</button>
            <button className="btn-primary" onClick={addEvent}>Add</button>
          </>
        }
      >
        {newEvent && (
          <div>
            <Field label="Title">
              <input
                className="input"
                autoFocus
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </Field>
            <Field label="When">
              <input
                type="datetime-local"
                data-vkeyboard="off"
                className="input"
                value={newEvent.at}
                onChange={(e) => setNewEvent({ ...newEvent, at: e.target.value })}
              />
            </Field>
            <Field label="Note">
              <input
                className="input"
                value={newEvent.note}
                onChange={(e) => setNewEvent({ ...newEvent, note: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

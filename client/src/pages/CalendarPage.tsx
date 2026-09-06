import { useEffect, useRef, useState, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg, EventInput } from '@fullcalendar/core';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { api } from '../lib/api';
import { useSettings } from '../context/SettingsContext';
import { useFeedback } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Field } from '../components/ui/Field';
import type { EventItem, Category, CalendarSubscription } from '../types';
import { calendarChoices, eventCalendarId } from '../lib/calendarChoices';
import type { CalendarChoice, GoogleCalendarChoice } from '../lib/calendarChoices';
import { toLocalInput, fromLocalInput } from '../lib/dates';
import { useFamily, memberColor } from '../hooks/useFamily';
import { MemberFilter, MemberSelect } from '../components/MemberBadge';

interface EditState {
  id?: number;
  title: string;
  description: string;
  location: string;
  start: string; // datetime-local value
  end: string;
  all_day: boolean;
  category_id: number | null;
  member_id: number | null;
  source?: string;
}

const emptyEvent = (start?: Date, end?: Date): EditState => ({
  title: '',
  description: '',
  location: '',
  start: toLocalInput(start || new Date()),
  end: toLocalInput(end || new Date(Date.now() + 3600000)),
  all_day: false,
  category_id: null,
  member_id: null,
});

export default function CalendarPage() {
  const { get } = useSettings();
  const { toast, confirm } = useFeedback();
  const { members } = useFamily();
  const calRef = useRef<FullCalendar | null>(null);
  const [rawEvents, setRawEvents] = useState<EventItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [memberFilter, setMemberFilter] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [calendars, setCalendars] = useState<CalendarChoice[]>([]);
  const [calendarFilter, setCalendarFilter] = useState(() => {
    try { return localStorage.getItem('wp:calendar:selected') || 'all'; }
    catch { return 'all'; }
  });

  useEffect(() => {
    try { localStorage.setItem('wp:calendar:selected', calendarFilter); }
    catch { /* Calendar switching still works when storage is unavailable. */ }
  }, [calendarFilter]);

  const load = useCallback(async () => {
    try {
      const [evs, cats, subscriptions, google] = await Promise.all([
        api.get<EventItem[]>('/events', true),
        api.get<Category[]>('/categories', true),
        api.get<CalendarSubscription[]>('/subscriptions').catch(() => []),
        api.get<{ connected: boolean }>('/google/status').then(status => status.connected
          ? api.get<GoogleCalendarChoice[]>('/google/calendars', true) : []).catch(() => []),
      ]);
      const choices = calendarChoices(evs, subscriptions, google);
      setCalendars(choices);
      setCalendarFilter(current => current === 'all' || choices.some(c => c.id === current) ? current : 'all');
      setCategories(cats);
      setRawEvents(evs);
    } catch {
      toast('Could not load calendar', 'error');
    }
  }, [toast]);

  // Member color takes priority over category color so people read at a glance;
  // an explicit per-event color still wins. Filter by member when selected.
  const catColor = (id?: number | null) => categories.find((c) => c.id === id)?.color;
  const events: EventInput[] = rawEvents
    .filter((e) => calendarFilter === 'all' || eventCalendarId(e) === calendarFilter)
    .filter((e) => memberFilter === null || e.member_id === memberFilter)
    .map((e) => ({
      id: String(e.id),
      title: e.title,
      start: e.start,
      end: e.end,
      allDay: !!e.all_day,
      backgroundColor:
        e.color ||
        (e.member_id ? memberColor(members, e.member_id) : undefined) ||
        catColor(e.category_id) ||
        undefined,
      extendedProps: { raw: e },
    }));

  useEffect(() => {
    load();
  }, [load]);

  const onSelect = (sel: DateSelectArg) => {
    setEdit(emptyEvent(sel.start, sel.end));
    calRef.current?.getApi().unselect();
  };

  const onEventClick = (arg: EventClickArg) => {
    const raw = arg.event.extendedProps.raw as EventItem;
    setEdit({
      id: raw.id,
      title: raw.title,
      description: raw.description || '',
      location: raw.location || '',
      start: toLocalInput(new Date(raw.start)),
      end: toLocalInput(new Date(raw.end)),
      all_day: !!raw.all_day,
      category_id: raw.category_id ?? null,
      member_id: raw.member_id ?? null,
      source: raw.source,
    });
  };

  const save = async () => {
    if (!edit) return;
    if (!edit.title.trim()) return toast('Give the event a title', 'error');
    const payload = {
      title: edit.title.trim(),
      description: edit.description || null,
      location: edit.location || null,
      start: fromLocalInput(edit.start),
      end: fromLocalInput(edit.end),
      all_day: edit.all_day,
      category_id: edit.category_id,
      member_id: edit.member_id,
    };
    try {
      if (edit.id) await api.put(`/events/${edit.id}`, payload);
      else await api.post('/events', payload);
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
      title: 'Delete event?',
      message: `"${edit.title}" will be removed.`,
      danger: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await api.del(`/events/${edit.id}`);
      toast('Deleted', 'success');
      setEdit(null);
      load();
    } catch {
      toast('Could not delete', 'error');
    }
  };

  return (
    <div className="p-6 h-full flex flex-col max-w-[1600px] mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-display font-bold text-content">Calendar</h1>
        <button className="btn-primary" onClick={() => setEdit(emptyEvent())}>
          <Plus size={22} /> New event
        </button>
      </div>

      <section className="card p-3 mb-3" aria-label="Calendar selection">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-sm font-semibold text-content">Show calendar</h2>
          <a className="text-sm text-content-soft underline" href="#/settings">Manage calendars</a>
        </div>
        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto" role="group" aria-label="Show calendar">
          {[{ id: 'all', name: 'All calendars' }, ...calendars].map((calendar: CalendarChoice) => (
            <button key={calendar.id} type="button" aria-pressed={calendarFilter === calendar.id}
              className={`${calendarFilter === calendar.id ? 'btn-primary' : 'btn-ghost'} !py-2 !px-3 min-h-[44px] max-w-full`}
              onClick={() => setCalendarFilter(calendar.id)}>
              {calendar.color && <span aria-hidden="true" className="w-3 h-3 rounded-full shrink-0 border border-current" style={{ backgroundColor: calendar.color }} />}
              <span className="truncate">{calendar.name}</span>
            </button>
          ))}
        </div>
      </section>

      {members.length > 0 && (
        <div className="mb-3">
          <MemberFilter members={members} value={memberFilter} onChange={setMemberFilter} />
        </div>
      )}

      <div className="card p-4 flex-1 overflow-hidden">
        <FullCalendar
          ref={calRef}
          height="100%"
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={get<string>('calendar.defaultView', 'timeGridWeek')}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
          }}
          buttonText={{
            today: 'Today',
            month: 'Month',
            week: 'Week',
            day: 'Day',
            list: 'Agenda',
          }}
          firstDay={get<number>('calendar.weekStartsOn', 0)}
          nowIndicator
          selectable
          selectMirror
          select={onSelect}
          eventClick={onEventClick}
          events={events}
          slotMinTime={get<string>('calendar.businessStart', '06:00') + ':00'}
          slotMaxTime="23:00:00"
          longPressDelay={200}
          selectLongPressDelay={200}
          eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
        />
      </div>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit event' : 'New event'}
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
            {edit.source === 'google' && (
              <div className="mb-3 chip bg-sky-100 text-sky-700">From Google Calendar</div>
            )}
            <Field label="Title">
              <input
                className="input"
                value={edit.title}
                autoFocus
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">
                <input
                  type="datetime-local"
                  data-vkeyboard="off"
                  className="input"
                  value={edit.start}
                  onChange={(e) => setEdit({ ...edit, start: e.target.value })}
                />
              </Field>
              <Field label="Ends">
                <input
                  type="datetime-local"
                  data-vkeyboard="off"
                  className="input"
                  value={edit.end}
                  onChange={(e) => setEdit({ ...edit, end: e.target.value })}
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                className="w-6 h-6 accent-[rgb(var(--accent))]"
                checked={edit.all_day}
                onChange={(e) => setEdit({ ...edit, all_day: e.target.checked })}
              />
              <span className="text-lg text-content">All day</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
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
              <Field label="Whose">
                <MemberSelect
                  members={members}
                  value={edit.member_id}
                  onChange={(id) => setEdit({ ...edit, member_id: id })}
                />
              </Field>
            </div>
            <Field label="Location">
              <div className="relative">
                <MapPin
                  size={20}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-content-faint"
                />
                <input
                  className="input pl-10"
                  value={edit.location}
                  onChange={(e) => setEdit({ ...edit, location: e.target.value })}
                />
              </div>
            </Field>
            <Field label="Notes">
              <textarea
                className="input min-h-[5rem]"
                value={edit.description}
                onChange={(e) => setEdit({ ...edit, description: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

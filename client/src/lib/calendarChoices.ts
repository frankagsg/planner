import type { EventItem, CalendarSubscription } from '../types/index.ts';

export interface CalendarChoice { id: string; name: string; color?: string }
export interface GoogleCalendarChoice { id: string; summary: string; backgroundColor?: string }

export function eventCalendarId(event: Pick<EventItem, 'source' | 'google_cal_id'>): string {
  if (event.source === 'local') return 'local';
  return `${event.source}:${event.google_cal_id || 'unknown'}`;
}

export function calendarChoices(
  events: EventItem[],
  subscriptions: Pick<CalendarSubscription, 'id' | 'name' | 'color'>[],
  google: GoogleCalendarChoice[],
): CalendarChoice[] {
  const choices = new Map<string, CalendarChoice>();
  choices.set('local', { id: 'local', name: 'Planner events' });
  for (const sub of subscriptions) {
    const id = `ics:ics:${sub.id}`;
    choices.set(id, { id, name: sub.name, color: sub.color });
  }
  for (const event of events) {
    const id = eventCalendarId(event);
    if (choices.has(id)) continue;
    const remote = google.find(c => c.id === event.google_cal_id);
    choices.set(id, {
      id,
      name: event.source === 'google'
        ? `${remote?.summary || event.google_cal_id || 'Calendar'} (Google)`
        : 'Imported calendar',
      color: remote?.backgroundColor || event.color || undefined,
    });
  }
  return [...choices.values()];
}

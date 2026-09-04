import { differenceInCalendarDays, formatDistanceToNowStrict, isValid } from 'date-fns';

export function daysUntil(target: string): number {
  const d = new Date(target);
  if (!isValid(d)) return 0;
  return differenceInCalendarDays(d, new Date());
}

export function countdownLabel(target: string): string {
  const days = daysUntil(target);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `${days} days`;
}

// Human "in 3 hours" / "2 days" for near-term items.
export function relative(target: string): string {
  const d = new Date(target);
  if (!isValid(d)) return '';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

// Convert a Date to the value string an <input type="datetime-local"> expects,
// in LOCAL time (not UTC).
export function toLocalInput(date: Date): string {
  const off = date.getTimezoneOffset();
  const local = new Date(date.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function toDateInput(date: Date): string {
  return toLocalInput(date).slice(0, 10);
}

// Parse a datetime-local value (local) back into an ISO string.
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

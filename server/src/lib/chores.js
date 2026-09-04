// Chore recurrence + scheduling helpers. Pure date logic kept out of routes.

// days_of_week bit mask: Sunday=bit0 (1) .. Saturday=bit6 (64).
export function dayBit(dow) {
  return 1 << dow; // dow: 0..6 (JS getDay)
}

// Local YYYY-MM-DD for a Date (avoids UTC off-by-one from toISOString).
export function localDate(d = new Date()) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// Does a chore apply on the given local date?
export function choreAppliesOn(chore, dateStr) {
  if (!chore.active) return false;
  const d = new Date(dateStr + 'T00:00:00');
  const dow = d.getDay();
  switch (chore.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
    case 'specific-days':
      return (chore.days_of_week & dayBit(dow)) !== 0;
    case 'none':
    default:
      // One-off chores always show until completed (no schedule constraint).
      return true;
  }
}

// The 7 local date strings of the week containing `ref`, starting on weekStart
// (0=Sunday). Used for the "this week" view and the weekly leaderboard window.
export function weekDates(ref = new Date(), weekStart = 0) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const diff = (d.getDay() - weekStart + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return localDate(x);
  });
}

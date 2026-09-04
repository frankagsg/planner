// Tiny, dependency-free iCalendar (.ics, RFC 5545) parser.
// Scope is deliberately narrow: enough to merge read-only VEVENTs from public
// iCloud/Outlook/Google ICS feeds into our events table. It handles line
// unfolding, escaped text, DATE vs DATE-TIME, and UTC ("Z") / floating times.
// It does NOT expand RRULE recurrences (kept simple + robust); recurring feeds
// still import their master + any explicit overrides the provider emits.

// Unfold folded lines: a CRLF followed by a space/tab continues the prior line.
function unfold(raw) {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

function unescapeText(v) {
  return v
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

// Parse a DTSTART/DTEND value + its params into { iso, allDay }.
function parseDate(value, params) {
  const isDateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(value);
  if (isDateOnly) {
    // YYYYMMDD -> YYYY-MM-DD (all-day)
    const y = value.slice(0, 4);
    const m = value.slice(4, 6);
    const d = value.slice(6, 8);
    return { iso: `${y}-${m}-${d}`, allDay: true };
  }
  // DATE-TIME: YYYYMMDDTHHMMSS[Z]
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(value);
  if (!match) {
    const d = new Date(value);
    return { iso: Number.isNaN(d.getTime()) ? null : d.toISOString(), allDay: false };
  }
  const [, y, mo, da, h, mi, s, z] = match;
  if (z === 'Z') {
    return { iso: new Date(`${y}-${mo}-${da}T${h}:${mi}:${s}Z`).toISOString(), allDay: false };
  }
  // Floating / TZID local time — treat as local wall-clock. Good enough for a
  // household kiosk in a single timezone.
  const local = new Date(
    Number(y),
    Number(mo) - 1,
    Number(da),
    Number(h),
    Number(mi),
    Number(s)
  );
  return { iso: Number.isNaN(local.getTime()) ? null : local.toISOString(), allDay: false };
}

// Split a content line "NAME;PARAM=x:VALUE" into { name, params, value }.
function parseLine(line) {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = left.split(';');
  const name = parts[0].toUpperCase();
  const params = {};
  for (let i = 1; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
  }
  return { name, params, value };
}

// Parse an ICS document into an array of normalized events.
export function parseICS(raw) {
  const text = unfold(String(raw || ''));
  const lines = text.split('\n');
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur && cur.start) {
        // Default end = start when a provider omits DTEND.
        if (!cur.end) cur.end = cur.start;
        events.push(cur);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, params, value } = parsed;
    switch (name) {
      case 'UID':
        cur.uid = value;
        break;
      case 'SUMMARY':
        cur.title = unescapeText(value);
        break;
      case 'DESCRIPTION':
        cur.description = unescapeText(value);
        break;
      case 'LOCATION':
        cur.location = unescapeText(value);
        break;
      case 'DTSTART': {
        const { iso, allDay } = parseDate(value, params);
        cur.start = iso;
        cur.allDay = allDay;
        break;
      }
      case 'DTEND': {
        const { iso } = parseDate(value, params);
        cur.end = iso;
        break;
      }
      case 'STATUS':
        cur.status = value;
        break;
      default:
        break;
    }
  }

  return events
    .filter((e) => e.start && (e.status || '').toUpperCase() !== 'CANCELLED')
    .map((e, i) => ({
      uid: e.uid || `noid-${i}-${e.start}`,
      title: e.title || '(no title)',
      description: e.description || null,
      location: e.location || null,
      start: e.start,
      end: e.end || e.start,
      allDay: Boolean(e.allDay),
    }));
}

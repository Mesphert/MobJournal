// Timezone helpers built on Intl (no libraries). All instants are UTC ms.

export const systemTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const dtfCache = new Map();
function dtf(tz) {
  if (!dtfCache.has(tz)) {
    dtfCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short',
    }));
  }
  return dtfCache.get(tz);
}

const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(ts, tz) {
  const p = {};
  for (const { type, value } of dtf(tz).formatToParts(new Date(ts))) p[type] = value;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour, minute: +p.minute, second: +p.second,
    weekday: WEEKDAYS[p.weekday],
  };
}

/** Offset (ms) of tz from UTC at a given instant. */
export function tzOffset(ts, tz) {
  const p = zonedParts(ts, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ts / 1000) * 1000;
}

/** Wall time in tz -> UTC ms (DST-safe). month is 1-12. */
export function wallToUtc(year, month, day, hour, minute, tz) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let utc = guess - tzOffset(guess, tz);
  const fix = guess - tzOffset(utc, tz);
  return fix === utc ? utc : fix;
}

export const parseHM = (s) => {
  const [h, m] = s.split(':').map(Number);
  return { h, m };
};

/** Add days to a calendar date (y, m 1-12, d) without touching timezones. */
export function addDays(y, m, d, n) {
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export function formatInTz(ts, tz, opts = {}) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...opts }).format(new Date(ts));
}

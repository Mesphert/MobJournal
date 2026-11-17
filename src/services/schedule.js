// Pure logic: which range is active now / next, DST-safe.
import { zonedParts, wallToUtc, parseHM, addDays } from '../core/time.js';

/** All occurrences (UTC ms) of a range that could touch [now-1d, now+8d]. */
function occurrences(range, now) {
  const { h: sh, m: sm } = parseHM(range.start);
  const { h: eh, m: em } = parseHM(range.end);
  const crossesMidnight = eh * 60 + em <= sh * 60 + sm;
  const today = zonedParts(now, range.tz);
  const out = [];
  for (let n = -1; n <= 8; n++) {
    const d = addDays(today.year, today.month, today.day, n);
    // weekday of the *start* date in the range's own timezone
    const wd = new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
    if (!range.days.includes(wd)) continue;
    const start = wallToUtc(d.year, d.month, d.day, sh, sm, range.tz);
    const e = crossesMidnight ? addDays(d.year, d.month, d.day, 1) : d;
    const end = wallToUtc(e.year, e.month, e.day, eh, em, range.tz);
    out.push({ start, end });
  }
  return out;
}

/** -> { active: {start,end}|null, next: {start,end}|null } */
export function rangeState(range, now = Date.now()) {
  const occ = occurrences(range, now);
  const active = occ.find((o) => o.start <= now && now < o.end) ?? null;
  const next = occ.find((o) => o.start > now) ?? null;
  return { active, next };
}

/** Which ranges contain a given instant (used later for trade enrichment). */
export function rangesAt(ranges, ts) {
  return ranges.filter((r) => rangeState(r, ts).active);
}

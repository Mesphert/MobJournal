import { all, batch } from '../core/db.js';
import { SESSION_SEEDS } from './seeds/sessions.js';
import { ICT_SEEDS } from './seeds/ict-ranges.js';

const TFS = ['1m', '2m', '3m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];

/** Idempotent: inserts only rows whose key/tf doesn't exist yet. User edits are never overwritten. */
export async function seedDefaults() {
  const haveSessions = new Set((await all('SELECT key FROM sessions')).map((r) => r.key));
  const haveIct = new Set((await all('SELECT key FROM ict_ranges')).map((r) => r.key));
  const haveTf = new Set((await all('SELECT tf FROM tf_enabled')).map((r) => r.tf));
  const sets = [];

  SESSION_SEEDS.forEach((s, i) => {
    if (haveSessions.has(s.key)) return;
    sets.push({
      statement: 'INSERT INTO sessions (key, name, tz, start, end, days, color, sort) VALUES (?,?,?,?,?,?,?,?)',
      values: [s.key, s.name, s.tz, s.start, s.end, s.days ?? '1,2,3,4,5', s.color, i],
    });
  });
  ICT_SEEDS.forEach((s, i) => {
    if (haveIct.has(s.key)) return;
    sets.push({
      statement: 'INSERT INTO ict_ranges (key, name, kind, tz, start, end, days, sort) VALUES (?,?,?,?,?,?,?,?)',
      values: [s.key, s.name, s.kind, s.tz, s.start, s.end, s.days, i],
    });
  });
  TFS.forEach((tf, i) => {
    if (haveTf.has(tf)) return;
    sets.push({ statement: 'INSERT INTO tf_enabled (tf, enabled, sort) VALUES (?,1,?)', values: [tf, i] });
  });

  if (sets.length) await batch(sets);
}

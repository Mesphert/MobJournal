import { all } from '../../core/db.js';

const toRow = (r) => ({ ...r, days: r.days.split(',').map(Number), enabled: !!r.enabled });

export async function listSessions() {
  return (await all('SELECT * FROM sessions WHERE enabled = 1 ORDER BY sort, id')).map(toRow);
}
export async function listIctRanges() {
  return (await all('SELECT * FROM ict_ranges WHERE enabled = 1 ORDER BY sort, id')).map(toRow);
}

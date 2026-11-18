import { all, get, run, batch } from './db.js';
import { brokerToUtc } from './broker-time.js';
import { SESSION_SEEDS, ICT_SEEDS } from './seeds.js';

const TFS = ['1m', '2m', '3m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];

// ---------------- settings ----------------
export const SETTING_DEFAULTS = {
  theme: 'system',              // system | light | dark
  timezone: '',                 // '' = system timezone
  max_trades_per_day: '3',
  max_loss_per_day: '100',
  max_loss_per_trade: '50',
  show_saturday: '0',
  show_sunday: '0',
  broker_time_mode: 'ny_close', // ny_close | fixed
  broker_utc_offset: '2',       // used when mode = fixed
  be_threshold: '0.5',          // |net P&L| at or below this = breakeven ($)
};

export async function loadSettings() {
  const out = { ...SETTING_DEFAULTS };
  for (const { key, value } of await all('SELECT key, value FROM settings')) out[key] = value;
  return out;
}
// Portable upsert: Android < 11 ships an SQLite too old for ON CONFLICT ... DO UPDATE.
export const saveSetting = (key, value) => batch([
  { sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', params: [key, String(value)] },
  { sql: 'UPDATE settings SET value = ? WHERE key = ?', params: [String(value), key] },
]);

// ---------------- seed (idempotent, never overwrites user edits) ----------------
export async function seedDefaults() {
  const haveS = new Set((await all('SELECT key FROM sessions')).map((r) => r.key));
  const haveI = new Set((await all('SELECT key FROM ict_ranges')).map((r) => r.key));
  const haveT = new Set((await all('SELECT tf FROM tf_enabled')).map((r) => r.tf));
  const st = [];
  SESSION_SEEDS.forEach((s, i) => haveS.has(s.key) || st.push({
    sql: 'INSERT INTO sessions (key, name, tz, start, end, days, color, sort) VALUES (?,?,?,?,?,?,?,?)',
    params: [s.key, s.name, s.tz, s.start, s.end, s.days ?? '1,2,3,4,5', s.color, i],
  }));
  ICT_SEEDS.forEach((s, i) => haveI.has(s.key) || st.push({
    sql: 'INSERT INTO ict_ranges (key, name, kind, tz, start, end, days, sort) VALUES (?,?,?,?,?,?,?,?)',
    params: [s.key, s.name, s.kind, s.tz, s.start, s.end, s.days, i],
  }));
  TFS.forEach((tf, i) => haveT.has(tf) || st.push({ sql: 'INSERT INTO tf_enabled (tf, enabled, sort) VALUES (?,1,?)', params: [tf, i] }));
  await batch(st);
}

// ---------------- sessions / ICT ranges ----------------
const toRange = (r) => ({ ...r, days: r.days.split(',').map(Number), enabled: !!r.enabled });
export const listSessions = async () => (await all('SELECT * FROM sessions WHERE enabled = 1 ORDER BY sort, id')).map(toRange);
export const listIctRanges = async () => (await all('SELECT * FROM ict_ranges WHERE enabled = 1 ORDER BY sort, id')).map(toRange);

// ---------------- trades ----------------
const r2 = (n) => Math.round(n * 100) / 100;
const brokerCfg = (s) => ({ mode: s.broker_time_mode, offsetHours: Number(s.broker_utc_offset) || 0 });
export const classify = (net, thr) => (net > thr ? 'win' : net < -thr ? 'loss' : 'be');

/** Insert new trades, update existing ones by ticket. Journal data lives in another table, so it is never touched. */
export async function importTrades(parsed, settings) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const have = new Set((await all('SELECT ticket FROM trades')).map((r) => r.ticket));
  let added = 0, updated = 0;
  const now = Date.now();
  const COLS = `symbol, side, volume, open_time, close_time, open_raw, close_raw, open_price, close_price,
    sl, tp, commission, swap, profit, net_pnl, result, account`;
  const insertSql = `INSERT INTO trades (ticket, ${COLS}, source, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'mt5-import',?)`;
  const updateSql = `UPDATE trades SET ${COLS.split(',').map((c) => c.trim() + ' = ?').join(', ')} WHERE ticket = ?`;
  const seen = new Set(have);
  const statements = parsed.trades.map((t) => {
    const net = r2(t.profit + t.commission + t.swap);
    const f = [
      t.symbol, t.side, t.volume,
      brokerToUtc(t.openRaw, cfg), brokerToUtc(t.closeRaw, cfg), t.openRaw, t.closeRaw,
      t.openPrice, t.closePrice, t.sl, t.tp, t.commission, t.swap, t.profit, net,
      classify(net, thr), parsed.account,
    ];
    if (seen.has(t.ticket)) { updated++; return { sql: updateSql, params: [...f, t.ticket] }; }
    seen.add(t.ticket); added++;
    return { sql: insertSql, params: [t.ticket, ...f, now] };
  });
  await batch(statements);
  return { added, updated, total: statements.length };
}

/** Re-derive UTC times and win/loss/be after broker-time or breakeven settings change. */
export async function recomputeDerived(settings) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const rows = await all('SELECT id, open_raw, close_raw, net_pnl FROM trades');
  await batch(rows.map((r) => ({
    sql: 'UPDATE trades SET open_time = COALESCE(?, open_time), close_time = COALESCE(?, close_time), result = ? WHERE id = ?',
    params: [brokerToUtc(r.open_raw, cfg), brokerToUtc(r.close_raw, cfg), classify(r.net_pnl, thr), r.id],
  })));
}

export const countTrades = async () => (await get('SELECT COUNT(*) AS n FROM trades')).n;

export function listTrades({ limit = 20, offset = 0 } = {}) {
  const lim = Math.max(1, Math.floor(Number(limit)) || 20);   // inlined: the native layer binds params as text
  const off = Math.max(0, Math.floor(Number(offset)) || 0);
  return all(`SELECT id, symbol, side, volume, open_time, close_time, net_pnl, result
              FROM trades ORDER BY open_time DESC, id DESC LIMIT ${lim} OFFSET ${off}`);
}

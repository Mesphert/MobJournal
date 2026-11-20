import { all, get, run, batch } from './db.js';
import { brokerToUtc } from './broker-time.js';
import { SESSION_SEEDS, ICT_SEEDS } from './seeds.js';
import { TF_ORDER, DISCIPLINE_BREACH } from './input-builder.js';

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
  current_account_id: '',       // selected journal
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

  // Starter input values (from your examples) are seeded once, so values you delete never come back.
  if (!(await get("SELECT value FROM settings WHERE key = 'seed_inputs_v1'"))) {
    const names = {
      poi: ['OB', 'FVG'], setup_model: ['CRT'], entry_model: ['Unicorn', 'CISD', 'OTE'], target: ['BSL', 'SSL'],
      quality: ['A+', 'A', 'B+', 'B', 'C'], discipline: [DISCIPLINE_BREACH, 'Followed plan'],
    };
    await batch(Object.entries(names).flatMap(([cat, list]) =>
      list.map((n) => ({ sql: 'INSERT OR IGNORE INTO input_values (category, name, tfs) VALUES (?, ?, NULL)', params: [cat, n] }))));
    await saveSetting('seed_inputs_v1', '1');
  }
}

// ---------------- sessions / ICT ranges ----------------
const toRange = (r) => ({ ...r, days: r.days.split(',').map(Number), enabled: !!r.enabled });
export const listSessions = async () => (await all('SELECT * FROM sessions WHERE enabled = 1 ORDER BY sort, id')).map(toRange);
export const listIctRanges = async () => (await all('SELECT * FROM ict_ranges WHERE enabled = 1 ORDER BY sort, id')).map(toRange);

// ---------------- journals (accounts) ----------------
export async function listAccounts() {
  return all('SELECT id, name, mt5_id, starting_balance FROM accounts ORDER BY id');
}
/** id -> { net, count } for balance display */
export async function accountStats() {
  const rows = await all('SELECT account_id, COUNT(*) AS n, COALESCE(SUM(net_pnl), 0) AS net FROM trades GROUP BY account_id');
  return new Map(rows.map((r) => [r.account_id, { count: r.n, net: r.net }]));
}
export async function createAccount({ name, mt5Id = '', startingBalance = 0 }) {
  const clean = String(name ?? '').trim();
  if (!clean) throw new Error('Enter a journal name');
  const mt5 = String(mt5Id ?? '').trim();
  if (mt5 && (await get('SELECT id FROM accounts WHERE mt5_id = ?', [mt5]))) throw new Error('Another journal already uses that MT5 account ID');
  await run('INSERT INTO accounts (name, mt5_id, starting_balance, created_at) VALUES (?, ?, ?, ?)',
    [clean, mt5 || null, Number(startingBalance) || 0, Date.now()]);
  return (await get('SELECT MAX(id) AS id FROM accounts')).id;
}
export async function updateAccount(id, { name, mt5Id = '', startingBalance = 0 }) {
  const clean = String(name ?? '').trim();
  if (!clean) throw new Error('Enter a journal name');
  const mt5 = String(mt5Id ?? '').trim();
  if (mt5 && (await get('SELECT id FROM accounts WHERE mt5_id = ? AND id != ?', [mt5, id]))) throw new Error('Another journal already uses that MT5 account ID');
  await run('UPDATE accounts SET name = ?, mt5_id = ?, starting_balance = ? WHERE id = ?', [clean, mt5 || null, Number(startingBalance) || 0, id]);
}
/** Screenshot file paths of a journal (so the files can be removed before the rows go). */
export async function accountShotPaths(id) {
  return (await all('SELECT s.file_path FROM trade_screenshots s JOIN trades t ON t.id = s.trade_id WHERE t.account_id = ?', [id])).map((r) => r.file_path);
}
export async function deleteAccount(id) {
  await batch([
    { sql: 'DELETE FROM trades WHERE account_id = ?', params: [id] },   // journal / screenshots / enrichment cascade
    { sql: 'DELETE FROM accounts WHERE id = ?', params: [id] },
  ]);
}
/** Trades saved before journals existed get adopted into one "Main account" so nothing is lost. */
export async function adoptLegacyTrades() {
  if (!(await get('SELECT id FROM trades WHERE account_id IS NULL LIMIT 1'))) return;
  const mt5 = (await get('SELECT account FROM trades WHERE account IS NOT NULL LIMIT 1'))?.account ?? null;
  let acc = mt5 ? await get('SELECT id FROM accounts WHERE mt5_id = ?', [mt5]) : null;
  if (!acc) {
    await run('INSERT INTO accounts (name, mt5_id, starting_balance, created_at) VALUES (?, ?, 0, ?)', ['Main account', mt5, Date.now()]);
    acc = await get('SELECT MAX(id) AS id FROM accounts');
  }
  await run("UPDATE trades SET account_id = ?, ticket = CAST(? AS INTEGER) || ':' || ticket WHERE account_id IS NULL", [acc.id, acc.id]);
}

// ---------------- trades ----------------
const r2 = (n) => Math.round(n * 100) / 100;
const brokerCfg = (s) => ({ mode: s.broker_time_mode, offsetHours: Number(s.broker_utc_offset) || 0 });
export const classify = (net, thr) => (net > thr ? 'win' : net < -thr ? 'loss' : 'be');

/**
 * Insert new trades, update existing ones. `ticket` is stored as "<journal id>:<MT5 ticket>" so the same ticket
 * number in two journals never collides. Journal notes live in another table and are never touched.
 */
export async function importTrades(parsed, settings, accountId) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const have = new Set((await all('SELECT ticket FROM trades WHERE account_id = ?', [accountId])).map((r) => r.ticket));
  let added = 0, updated = 0;
  const now = Date.now();
  const COLS = `symbol, side, volume, open_time, close_time, open_raw, close_raw, open_price, close_price,
    sl, tp, commission, swap, profit, net_pnl, result, account`;
  const insertSql = `INSERT INTO trades (ticket, ticket_raw, account_id, ${COLS}, source, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'mt5-import',?)`;
  const updateSql = `UPDATE trades SET ${COLS.split(',').map((c) => c.trim() + ' = ?').join(', ')} WHERE ticket = ?`;
  const seen = new Set(have);
  const statements = parsed.trades.map((t) => {
    const key = `${accountId}:${t.ticket}`;
    const net = r2(t.profit + t.commission + t.swap);
    const f = [
      t.symbol, t.side, t.volume,
      brokerToUtc(t.openRaw, cfg), brokerToUtc(t.closeRaw, cfg), t.openRaw, t.closeRaw,
      t.openPrice, t.closePrice, t.sl, t.tp, t.commission, t.swap, t.profit, net,
      classify(net, thr), parsed.account,
    ];
    if (seen.has(key)) { updated++; return { sql: updateSql, params: [...f, key] }; }
    seen.add(key); added++;
    return { sql: insertSql, params: [key, t.ticket, accountId, ...f, now] };
  });
  await batch(statements);
  return { added, updated, total: statements.length };
}

/** Re-derive UTC times and win/loss/be after broker-time or breakeven settings change (all journals). */
export async function recomputeDerived(settings) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const rows = await all('SELECT id, open_raw, close_raw, net_pnl FROM trades');
  await batch(rows.map((r) => ({
    sql: 'UPDATE trades SET open_time = COALESCE(?, open_time), close_time = COALESCE(?, close_time), result = ? WHERE id = ?',
    params: [brokerToUtc(r.open_raw, cfg), brokerToUtc(r.close_raw, cfg), classify(r.net_pnl, thr), r.id],
  })));
}

export const countTrades = async (accountId) => (await get('SELECT COUNT(*) AS n FROM trades WHERE account_id = ?', [accountId])).n;

export function listTrades({ accountId, limit = 20, offset = 0 } = {}) {
  const lim = Math.max(1, Math.floor(Number(limit)) || 20);   // inlined: the native layer binds params as text
  const off = Math.max(0, Math.floor(Number(offset)) || 0);
  return all(`SELECT t.id, t.symbol, t.side, t.volume, t.open_time, t.close_time, t.net_pnl, t.result, j.quality
              FROM trades t LEFT JOIN trade_journal j ON j.trade_id = t.id
              WHERE t.account_id = ?
              ORDER BY t.open_time DESC, t.id DESC LIMIT ${lim} OFFSET ${off}`, [accountId]);
}
export const getTrade = (id) => get('SELECT * FROM trades WHERE id = ?', [id]);

/** Lightweight rows for dashboard maths (one journal). */
export const tradesForStats = (accountId) =>
  all('SELECT id, symbol, side, open_time, close_time, net_pnl, result FROM trades WHERE account_id = ?', [accountId]);

// ---------------- news (filled by the news sync later) ----------------
export const listNews = (fromTs, toTs) =>
  all('SELECT id, ts, country, title, impact, forecast, actual, previous FROM news WHERE ts >= ? AND ts < ? ORDER BY ts', [fromTs, toTs]);

// ---------------- timeframes + trade input values ----------------
export async function listTfs() {
  const map = new Map((await all('SELECT tf, enabled FROM tf_enabled')).map((r) => [r.tf, !!r.enabled]));
  return TF_ORDER.map((tf) => ({ tf, enabled: map.get(tf) ?? true }));
}
export const setTfEnabled = (tf, on) => batch([
  { sql: 'INSERT OR IGNORE INTO tf_enabled (tf, enabled, sort) VALUES (?, ?, ?)', params: [tf, on ? 1 : 0, TF_ORDER.indexOf(tf)] },
  { sql: 'UPDATE tf_enabled SET enabled = ? WHERE tf = ?', params: [on ? 1 : 0, tf] },
]);

export async function listValues(category) {
  return (await all('SELECT id, name, tfs FROM input_values WHERE category = ? ORDER BY id', [category]))
    .map((r) => ({ id: r.id, name: r.name, tfs: r.tfs ? JSON.parse(r.tfs) : null }));
}
/** tfs: array of timeframes, or null = all enabled timeframes */
export async function addValue(category, name, tfs = null) {
  const clean = name.trim();
  if (!clean) throw new Error('Enter a name');
  if (await get('SELECT id FROM input_values WHERE category = ? AND name = ? COLLATE NOCASE', [category, clean])) {
    throw new Error(`"${clean}" already exists`);
  }
  await run('INSERT INTO input_values (category, name, tfs) VALUES (?, ?, ?)', [category, clean, tfs ? JSON.stringify(tfs) : null]);
}
export async function updateValue(id, name, tfs = null) {
  const clean = name.trim();
  if (!clean) throw new Error('Enter a name');
  await run('UPDATE input_values SET name = ?, tfs = ? WHERE id = ?', [clean, tfs ? JSON.stringify(tfs) : null, id]);
}
export const deleteValue = (id) => run('DELETE FROM input_values WHERE id = ?', [id]);

export async function loadInputState(categories) {
  const enabledTfs = (await listTfs()).filter((t) => t.enabled).map((t) => t.tf);
  const values = {};
  for (const c of categories) values[c] = await listValues(c);
  return { enabledTfs, values };
}

// ---------------- journal ----------------
const JOURNAL_FIELDS = ['direction', 'bias', 'trade_type', 'poi', 'setup_model', 'setup_pd',
  'entry_model', 'entry_pd', 'target', 'quality', 'discipline', 'mood', 'notes'];
export async function getJournal(tradeId) {
  return (await get('SELECT * FROM trade_journal WHERE trade_id = ?', [tradeId])) ?? {};
}
export async function saveJournalField(tradeId, field, value) {
  if (!JOURNAL_FIELDS.includes(field)) throw new Error(`Unknown field ${field}`);
  await batch([
    { sql: 'INSERT OR IGNORE INTO trade_journal (trade_id) VALUES (?)', params: [tradeId] },
    { sql: `UPDATE trade_journal SET ${field} = ?, updated_at = ? WHERE trade_id = ?`, params: [value === '' ? null : value, Date.now(), tradeId] },
  ]);
}

// ---------------- screenshots (rows only; files live in app storage) ----------------
export const listShots = (tradeId) => all('SELECT id, tf, file_path FROM trade_screenshots WHERE trade_id = ? ORDER BY id', [tradeId]);
export const addShotRow = (tradeId, tf, path) =>
  run('INSERT INTO trade_screenshots (trade_id, tf, file_path, created_at) VALUES (?, ?, ?, ?)', [tradeId, tf, path, Date.now()]);
export const getShot = (id) => get('SELECT id, tf, file_path FROM trade_screenshots WHERE id = ?', [id]);
export const deleteShotRow = (id) => run('DELETE FROM trade_screenshots WHERE id = ?', [id]);

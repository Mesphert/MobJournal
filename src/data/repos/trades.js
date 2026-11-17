import { all, get, batch } from '../../core/db.js';
import { brokerToUtc } from '../../services/broker-time.js';

const r2 = (n) => Math.round(n * 100) / 100;

export const brokerCfg = (s) => ({
  mode: s.broker_time_mode,
  offsetHours: Number(s.broker_utc_offset) || 0,
});

/** net > threshold = win, net < -threshold = loss, otherwise breakeven. */
export const classify = (net, threshold) =>
  net > threshold ? 'win' : net < -threshold ? 'loss' : 'be';

/** Insert new trades, update existing ones by ticket (journal data lives elsewhere, so it is never touched). */
export async function importTrades(parsed, settings) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const have = new Set((await all('SELECT ticket FROM trades')).map((r) => r.ticket));
  let added = 0, updated = 0;
  const now = Date.now();

  const sets = parsed.trades.map((t) => {
    have.has(t.ticket) ? updated++ : added++;
    const net = r2(t.profit + t.commission + t.swap);
    return {
      statement: `
INSERT INTO trades (ticket, symbol, side, volume, open_time, close_time, open_raw, close_raw,
  open_price, close_price, sl, tp, commission, swap, profit, net_pnl, result, source, account, created_at)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'mt5-import',?,?)
ON CONFLICT(ticket) DO UPDATE SET
  symbol=excluded.symbol, side=excluded.side, volume=excluded.volume,
  open_time=excluded.open_time, close_time=excluded.close_time,
  open_raw=excluded.open_raw, close_raw=excluded.close_raw,
  open_price=excluded.open_price, close_price=excluded.close_price,
  sl=excluded.sl, tp=excluded.tp, commission=excluded.commission, swap=excluded.swap,
  profit=excluded.profit, net_pnl=excluded.net_pnl, result=excluded.result, account=excluded.account`,
      values: [
        t.ticket, t.symbol, t.side, t.volume,
        brokerToUtc(t.openRaw, cfg), brokerToUtc(t.closeRaw, cfg), t.openRaw, t.closeRaw,
        t.openPrice, t.closePrice, t.sl, t.tp, t.commission, t.swap, t.profit, net,
        classify(net, thr), parsed.account, now,
      ],
    };
  });
  await batch(sets);
  return { added, updated, total: parsed.trades.length };
}

/** Re-derive UTC times and win/loss/be after the broker-time or breakeven settings change. */
export async function recomputeDerived(settings) {
  const cfg = brokerCfg(settings);
  const thr = Number(settings.be_threshold) || 0;
  const rows = await all('SELECT id, open_raw, close_raw, net_pnl FROM trades');
  const sets = rows.map((r) => ({
    statement: 'UPDATE trades SET open_time = COALESCE(?, open_time), close_time = COALESCE(?, close_time), result = ? WHERE id = ?',
    values: [brokerToUtc(r.open_raw, cfg), brokerToUtc(r.close_raw, cfg), classify(r.net_pnl, thr), r.id],
  }));
  if (sets.length) await batch(sets);
}

export async function countTrades() {
  return (await get('SELECT COUNT(*) AS n FROM trades')).n;
}

export async function listTrades({ limit = 20, offset = 0 } = {}) {
  return all(
    `SELECT id, symbol, side, volume, open_time, close_time, net_pnl, result
     FROM trades ORDER BY open_time DESC, id DESC LIMIT ? OFFSET ?`,
    [limit, offset],
  );
}

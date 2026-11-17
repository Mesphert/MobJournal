/** Signed money string: +12.34 / −5.00 */
export function money(n) {
  const v = Number(n) || 0;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}`;
}

/** "Tue, 17-11-26 22:19" in the given timezone. */
export function tradeDate(ts, tz) {
  if (!ts) return '—';
  const p = {};
  for (const { type, value } of new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(ts))) p[type] = value;
  return `${p.weekday}, ${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/** Icon name for a symbol (metals, oil, crypto, indices, forex). */
export function symbolIconName(sym = '') {
  const s = sym.toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)|GOLD|SILVER/.test(s)) return 'Coins';
  if (/OIL|USO|UKO|BRENT|WTI|NGAS|XNG/.test(s)) return 'Fuel';
  if (/BTC|ETH|LTC|XRP|SOL|DOGE/.test(s)) return 'Bitcoin';
  if (/^[A-Z]{6}$/.test(s)) return 'DollarSign';      // forex pair
  return 'ChartLine';                                  // indices & the rest
}

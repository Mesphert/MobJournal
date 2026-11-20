// Pure logic: builds select options from user-defined values x timeframes, and filters by bias / trade type.

export const TF_ORDER = ['1m', '2m', '3m', '5m', '15m', '30m', '1H', '4H', '1D', '1W', '1M'];
export const DISCIPLINE_BREACH = 'Breached max loss per trade';

const PD = [{ name: 'Discount', sign: '+' }, { name: 'Premium', sign: '-' }];

/**
 * kind 'fixed'  : options defined here.        kind 'custom': options come from user-managed values.
 * tf            : option labels are prefixed with a timeframe.
 * polar         : each custom value generates a "+" (bullish) and "-" (bearish) option per timeframe.
 */
export const CATEGORIES = {
  direction:   { label: 'Overall market direction', kind: 'fixed', items: [{ name: 'Bullish' }, { name: 'Bearish' }, { name: 'Ranging' }] },
  bias:        { label: 'Bias', kind: 'fixed', tf: true, items: [{ name: 'Bullish', sign: '+' }, { name: 'Bearish', sign: '-' }] },
  trade_type:  { label: 'Trade type', kind: 'fixed', items: [{ name: 'To trend' }, { name: 'Counter trend' }] },
  poi:         { label: 'POI', kind: 'custom', tf: true, polar: true },
  setup_model: { label: 'Setup model', kind: 'custom', tf: true, polar: true },
  setup_pd:    { label: 'Setup PD', kind: 'fixed', tf: true, items: PD },
  entry_model: { label: 'Entry model', kind: 'custom', tf: true, polar: true },
  entry_pd:    { label: 'Entry PD', kind: 'fixed', tf: true, items: PD },
  target:      { label: 'Target', kind: 'custom', tf: true, polar: true },
  quality:     { label: 'Trade quality', kind: 'custom' },
  discipline:  { label: 'Discipline', kind: 'custom' },
};

/** Categories the user manages in Settings > Trade inputs. */
export const MANAGED = ['poi', 'setup_model', 'entry_model', 'target', 'quality', 'discipline'];
/** Categories whose options are narrowed by bias + trade type. */
export const FILTERED = ['poi', 'setup_model', 'setup_pd', 'entry_model', 'entry_pd', 'target'];

const orderTfs = (tfs) => TF_ORDER.filter((t) => tfs.includes(t));

/** -> [{ label, sign: '+' | '-' | null }] */
export function buildOptions(cat, { values = [], enabledTfs = TF_ORDER } = {}) {
  const c = CATEGORIES[cat];
  const tfs = orderTfs(enabledTfs);
  if (c.kind === 'fixed') {
    if (!c.tf) return c.items.map((i) => ({ label: i.name, sign: i.sign ?? null }));
    return tfs.flatMap((tf) => c.items.map((i) => ({ label: `${tf} ${i.name}`, sign: i.sign })));
  }
  if (!c.tf) return values.map((v) => ({ label: v.name, sign: null }));

  const out = [];
  for (const tf of tfs) {
    for (const v of values) {
      if (v.tfs && !v.tfs.includes(tf)) continue;
      out.push({ label: `${tf} +${v.name}`, sign: '+' }, { label: `${tf} -${v.name}`, sign: '-' });
    }
  }
  return out;
}

/** '+' | '-' | null.  To trend keeps the bias direction, counter trend takes the opposite. */
export function allowedSign(biasLabel, tradeType) {
  if (!biasLabel || !tradeType) return null;
  const bias = /bullish$/i.test(biasLabel) ? '+' : /bearish$/i.test(biasLabel) ? '-' : null;
  if (!bias) return null;
  if (/^to trend$/i.test(tradeType)) return bias;
  if (/^counter trend$/i.test(tradeType)) return bias === '+' ? '-' : '+';
  return null;
}

export const filterOptions = (opts, sign) => (sign ? opts.filter((o) => o.sign === sign) : opts);

/** Keep an already-saved value visible even if it is no longer generated (deleted value / disabled TF). */
export function withCurrent(opts, current) {
  if (!current || opts.some((o) => o.label === current)) return opts;
  return [{ label: current, sign: null, stale: true }, ...opts];
}

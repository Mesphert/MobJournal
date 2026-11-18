import { icon } from './icons.js';

// ---------- toast ----------
let timer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- theme ----------
let mq;
export function applyTheme(mode) {
  mq ??= window.matchMedia('(prefers-color-scheme: dark)');
  const dark = mode === 'dark' || (mode === 'system' && mq.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f17' : '#f4f6fb');
}
export function watchSystemTheme(getMode) {
  mq ??= window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => getMode() === 'system' && applyTheme('system'));
}

// ---------- nav ----------
export const TABS = [
  { id: 'trades', label: 'Trades', icon: 'List' },
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'time', label: 'Time', icon: 'Clock' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];
export function renderNav(el, activeId) {
  el.innerHTML = TABS.map((t) =>
    `<a href="#/${t.id}" class="${t.id === activeId ? 'active' : ''}">${icon(t.icon, 22)}<span>${t.label}</span></a>`).join('');
}

// ---------- formatting ----------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Signed money: +12.34 / −5.00 */
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

/** Icon for a symbol (metals, oil, crypto, forex, everything else = chart). */
export function symbolIconName(sym = '') {
  const s = sym.toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)|GOLD|SILVER/.test(s)) return 'Coins';
  if (/OIL|USO|UKO|BRENT|WTI|NGAS|XNG/.test(s)) return 'Fuel';
  if (/BTC|ETH|LTC|XRP|SOL|DOGE/.test(s)) return 'Bitcoin';
  if (/^[A-Z]{6}$/.test(s)) return 'DollarSign';
  return 'ChartLine';
}

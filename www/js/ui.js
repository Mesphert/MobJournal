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

// ---------- header ----------
/** Title bar. back = '#/route' shows a back arrow. actions = html for the right side. */
export function setHeader({ title = '', back = null, actions = '' } = {}) {
  document.getElementById('hdr').innerHTML =
    (back ? `<a class="hdr-back" href="${back}" aria-label="Back">${icon('ArrowLeft', 22)}</a>` : '') +
    `<h1 class="hdr-title">${esc(title)}</h1><div class="hdr-actions" id="hdr-actions">${actions}</div>`;
}
export const headerActions = () => document.getElementById('hdr-actions');

// ---------- bottom sheet ----------
export function openSheet(html) {
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  return { el: bg.firstChild, close };
}

// ---------- stars (1-5, tap the same star again to clear) ----------
export const starsHtml = (value) => `<div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) =>
  `<button type="button" data-star="${n}" class="${n <= (Number(value) || 0) ? 'on' : ''}" aria-label="${n} star">${icon('Star', 26)}</button>`).join('')}</div>`;

/** 4380000 -> "1h 13m" */
export function fmtHold(ms) {
  if (!(ms > 0)) return '—';
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : m ? `${m}m ${s % 60}s` : `${s}s`;
}

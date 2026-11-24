import { icon } from './icons.js';
import { appStore } from './store.js';

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
  { id: 'news', label: 'News', icon: 'Newspaper' },
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
/**
 * Title bar. back = '#/route' shows a back arrow. actions = html on the right.
 * journal = true puts the current journal pill on the right; tapping it opens the journal switcher.
 */
export function setHeader({ title = '', back = null, actions = '', journal = false } = {}) {
  const acct = appStore.get('account');
  const pill = journal && acct
    ? `<button class="hdr-acct" id="hdr-acct" aria-label="Switch journal"><i class="dot"></i><span class="nm">${esc(acct.name)}</span>${icon('ChevronDown', 14)}</button>` : '';
  document.getElementById('hdr').innerHTML =
    (back ? `<a class="hdr-back" href="${back}" aria-label="Back">${icon('ArrowLeft', 22)}</a>` : '') +
    `<div class="hdr-main"><h1 class="hdr-title">${esc(title)}</h1></div>` +
    `<div class="hdr-actions" id="hdr-actions">${actions}${pill}</div>`;
  document.getElementById('hdr-acct')?.addEventListener('click', () => window.dispatchEvent(new Event('openjournals')));
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

// ---------- numbers + flags ----------
/** 10030.1 -> "10,030.10" */
export const plain = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CURRENCY_COUNTRY = { USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU', CAD: 'CA', CHF: 'CH', NZD: 'NZ', CNY: 'CN', CNH: 'CN', SEK: 'SE', NOK: 'NO', MXN: 'MX', ZAR: 'ZA', INR: 'IN', BRL: 'BR', KRW: 'KR', SGD: 'SG', HKD: 'HK', TRY: 'TR' };
/** "US" / "USD" -> flag emoji (country or currency codes both work) */
export function flag(code) {
  const raw = String(code ?? '').trim().toUpperCase();
  const c = CURRENCY_COUNTRY[raw] ?? raw;
  if (!/^[A-Z]{2}$/.test(c)) return '🌐';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// ---------- custom dropdown (never the system <select>) ----------
const SELECTS = new Map();
let selSeq = 0;
export const resetSelects = () => SELECTS.clear();           // called on every route change
const labelOf = (options, value, ph) => options.find((o) => o.value === value)?.label ?? (value || ph);

/**
 * Returns the button markup for a dropdown. Options: [{ value, label }].
 * The button behaves like a select: it has .value and fires a bubbling 'change' event when the user picks something.
 * clearable adds a "None" row that sets the value to ''.
 */
export function selectHtml({ f = '', value = '', options = [], placeholder = '—', title = '', clearable = false, attrs = '' } = {}) {
  const id = 's' + (++selSeq);
  SELECTS.set(id, { options, placeholder, title, clearable });
  return `<button type="button" class="sel" data-sel="${id}" ${f ? `data-f="${f}"` : ''} value="${esc(value)}" ${attrs}>` +
    `<span class="sel-v ${value ? '' : 'ph'}">${esc(labelOf(options, value, placeholder))}</span>${icon('ChevronDown', 16)}</button>`;
}
export const selectOptions = (btn) => SELECTS.get(btn.dataset.sel)?.options ?? [];

function paintSelect(btn) {
  const c = SELECTS.get(btn.dataset.sel);
  const span = btn.querySelector('.sel-v');
  span.textContent = labelOf(c.options, btn.value, c.placeholder);
  span.classList.toggle('ph', !btn.value);
}
/** Replace the options (and optionally the value) of an existing dropdown without re-rendering the page. */
export function updateSelect(btn, { options, value } = {}) {
  const c = SELECTS.get(btn.dataset.sel);
  if (!c) return;
  if (options) c.options = options;
  if (value !== undefined) btn.value = value;
  paintSelect(btn);
}

function openSelect(btn) {
  const c = SELECTS.get(btn.dataset.sel);
  if (!c) return;
  const rows = (q = '') => {
    const needle = q.trim().toLowerCase();
    const list = c.options.filter((o) => !needle || String(o.label).toLowerCase().includes(needle));
    const none = c.clearable && !needle ? `<button class="opt none ${btn.value === '' ? 'on' : ''}" data-v="">None</button>` : '';
    return none + list.map((o) => `<button class="opt ${o.value === btn.value ? 'on' : ''}" data-v="${esc(o.value)}"><span>${esc(o.label)}</span>${o.value === btn.value ? icon('Check', 18) : ''}</button>`).join('')
      || '<div class="hint center" style="padding:16px">No matches</div>';
  };
  const { el, close } = openSheet(`
    ${c.title ? `<h2>${esc(c.title)}</h2>` : ''}
    ${c.options.length > 10 ? '<div class="search"><input class="field" id="selq" placeholder="Search" autocomplete="off"></div>' : ''}
    <div class="opts" id="selopts">${rows()}</div>`);
  el.querySelector('#selq')?.addEventListener('input', (e) => { el.querySelector('#selopts').innerHTML = rows(e.target.value); });
  el.querySelector('#selopts').addEventListener('click', (e) => {
    const o = e.target.closest('[data-v]');
    if (!o) return;
    btn.value = o.dataset.v;
    paintSelect(btn);
    close();
    btn.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
/** Call once at start-up. */
export function installSelects() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.sel');
    if (btn && !btn.disabled) openSelect(btn);
  });
}

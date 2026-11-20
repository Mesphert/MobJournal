import { openDb } from './db.js';
import { appStore } from './store.js';
import { systemTimeZone } from './time.js';
import { seedDefaults, loadSettings } from './data.js';
import { applyTheme, watchSystemTheme, renderNav, setHeader } from './ui.js';

// Each view exports mount(el, { args }) -> optional cleanup fn
const ROUTES = {
  trades: () => import('./views/trades.js'),
  dashboard: () => import('./views/dashboard.js'),
  time: () => import('./views/time.js'),
  settings: () => import('./views/settings.js'),
};
const DEFAULT = 'trades';
const TITLES = { trades: 'Trades', dashboard: 'Dashboard', time: 'Time', settings: 'Settings' };
let cleanup = null;
let token = 0;

function parse() {
  const [tab, ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { tab: ROUTES[tab] ? tab : DEFAULT, args };
}

async function render() {
  const my = ++token;
  const { tab, args } = parse();
  const old = document.getElementById('view');
  const view = old.cloneNode(false);   // fresh container: no listeners left over from the previous screen
  old.replaceWith(view);
  renderNav(document.getElementById('nav'), tab);
  setHeader({ title: TITLES[tab] });          // views may override (back arrow, actions)
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const mod = await ROUTES[tab]();
  if (my !== token) return;            // a newer navigation won
  view.scrollTop = 0;
  view.innerHTML = '';
  cleanup = (await mod.mount(view, { args })) ?? null;
}

async function boot() {
  const view = document.getElementById('view');
  try {
    await openDb();
    await seedDefaults();
    const settings = await loadSettings();
    appStore.set({ settings, timeZone: settings.timezone || systemTimeZone() });
    applyTheme(settings.theme);
    watchSystemTheme(() => appStore.get('settings').theme);
    window.addEventListener('hashchange', render);
    if (!location.hash) location.hash = `#/${DEFAULT}`; else render();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card loss">Startup failed:<br><small>${String(err?.message ?? err)}</small></div>`;
  }
}

boot();

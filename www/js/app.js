import { openDb } from './db.js';
import { appStore } from './store.js';
import { systemTimeZone } from './time.js';
import { seedDefaults, loadSettings, adoptLegacyTrades } from './data.js';
import { applyTheme, watchSystemTheme, renderNav, setHeader } from './ui.js';
import { refreshAccounts, selectAccount, openSwitcher, mountOnboarding } from './accounts.js';

// Each view exports mount(el, { args }) -> optional cleanup fn
const ROUTES = {
  trades: () => import('./views/trades.js'),
  dashboard: () => import('./views/dashboard.js'),
  time: () => import('./views/time.js'),
  news: () => import('./views/news.js'),
  settings: () => import('./views/settings.js'),
};
const DEFAULT = 'trades';
const TITLES = { trades: 'Trades', dashboard: 'Dashboard', time: 'Time', news: 'News', settings: 'Settings' };
const JOURNAL_TABS = new Set(['trades', 'dashboard']);   // pages that depend on the selected journal
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
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }

  const nav = document.getElementById('nav');
  if (!appStore.get('account')) {      // no journal yet: onboarding instead of the app
    nav.classList.add('hide');
    setHeader({ title: 'Welcome' });
    mountOnboarding(view, async (id) => { await selectAccount(id); location.hash = '#/trades'; });
    return;
  }
  nav.classList.remove('hide');
  renderNav(nav, tab);
  setHeader({ title: TITLES[tab], journal: JOURNAL_TABS.has(tab) });   // views may override
  const mod = await ROUTES[tab]();
  if (my !== token) return;            // a newer navigation won
  view.scrollTop = 0;
  cleanup = (await mod.mount(view, { args })) ?? null;
}

async function boot() {
  try {
    await openDb();
    await seedDefaults();
    await adoptLegacyTrades();
    const settings = await loadSettings();
    appStore.set({ settings, timeZone: settings.timezone || systemTimeZone() });
    await refreshAccounts();
    applyTheme(settings.theme);
    watchSystemTheme(() => appStore.get('settings').theme);
    window.addEventListener('hashchange', render);
    window.addEventListener('accountchange', render);
    window.addEventListener('openjournals', openSwitcher);
    if (!location.hash) location.hash = `#/${DEFAULT}`; else render();
  } catch (err) {
    console.error(err);
    document.getElementById('view').innerHTML = `<div class="card loss">Startup failed:<br><small>${String(err?.message ?? err)}</small></div>`;
  }
}

boot();

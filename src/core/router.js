import { renderNav } from '../ui/nav.js';

// Each feature exports: mount(el, { args }) -> optional cleanup fn
const ROUTES = {
  trades: () => import('../features/trades/index.js'),
  dashboard: () => import('../features/dashboard/index.js'),
  time: () => import('../features/time/index.js'),
  settings: () => import('../features/settings/index.js'),
};
const DEFAULT = 'trades';

let cleanup = null;
let token = 0;

function parse() {
  const [tab, ...args] = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return { tab: ROUTES[tab] ? tab : DEFAULT, args };
}

async function render() {
  const my = ++token;
  const { tab, args } = parse();
  const view = document.getElementById('view');
  renderNav(document.getElementById('nav'), tab);
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  const mod = await ROUTES[tab]();
  if (my !== token) return;          // a newer navigation won
  view.scrollTop = 0;
  view.innerHTML = '';
  cleanup = (await mod.mount(view, { args })) ?? null;
}

export function startRouter() {
  window.addEventListener('hashchange', render);
  if (!location.hash) location.hash = `#/${DEFAULT}`;
  else render();
}

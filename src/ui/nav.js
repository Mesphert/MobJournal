import { icon } from './icons.js';

export const TABS = [
  { id: 'trades', label: 'Trades', icon: 'List' },
  { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: 'time', label: 'Time', icon: 'Clock' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

export function renderNav(el, activeId) {
  el.innerHTML = TABS.map((t) => `
    <a href="#/${t.id}" class="nav-item ${t.id === activeId ? 'active' : ''}">
      ${icon(t.icon, 22)}<span>${t.label}</span>
    </a>`).join('');
}

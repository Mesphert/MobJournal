import {
  createElement, List, LayoutDashboard, Clock, Settings, Sun, Moon, Smartphone,
  Globe, ShieldAlert, CalendarDays, Newspaper, Timer, Flame, Inbox,
} from 'lucide';

const ICONS = {
  List, LayoutDashboard, Clock, Settings, Sun, Moon, Smartphone,
  Globe, ShieldAlert, CalendarDays, Newspaper, Timer, Flame, Inbox,
};

/** Returns an SVG markup string. Usage: icon('Clock', 18) */
export function icon(name, size = 20, cls = '') {
  const node = ICONS[name];
  if (!node) return '';
  const el = createElement(node);
  el.setAttribute('width', size);
  el.setAttribute('height', size);
  if (cls) el.setAttribute('class', cls);
  return el.outerHTML;
}

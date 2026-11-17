import { listSessions, listIctRanges } from '../../data/repos/schedule.js';
import { rangeState } from '../../services/schedule.js';
import { formatDuration, formatInTz } from '../../core/time.js';
import { appStore } from '../../core/store.js';
import { icon } from '../../ui/icons.js';

const KIND_LABEL = { killzone: 'Killzones', silver_bullet: 'Silver Bullets', macro: 'Macros' };

function row(r, now) {
  const { active, next } = rangeState(r, now);
  if (active) {
    return `<div class="flex items-center justify-between py-2">
      <span class="flex items-center gap-2">${icon('Flame', 16, 'text-win')}${r.name}</span>
      <span class="chip text-win">running ${formatDuration(now - active.start)}</span></div>`;
  }
  return `<div class="flex items-center justify-between py-2 text-muted">
    <span>${r.name}</span>
    <span class="chip">${next ? 'in ' + formatDuration(next.start - now) : '—'}</span></div>`;
}

export async function mount(el) {
  const [sessions, ict] = await Promise.all([listSessions(), listIctRanges()]);
  const tz = appStore.get('timeZone');

  const paint = () => {
    const now = Date.now();
    const groups = Object.keys(KIND_LABEL).map((k) => `
      <h3 class="text-xs uppercase tracking-wide text-muted mt-4 mb-1">${KIND_LABEL[k]}</h3>
      <div class="card divide-y divide-line">${ict.filter((r) => r.kind === k).map((r) => row(r, now)).join('')}</div>`).join('');
    el.innerHTML = `
      <div class="flex items-center justify-between mb-3">
        <h1 class="text-xl font-semibold">Time</h1>
        <span class="chip">${icon('Globe', 14)}${formatInTz(now, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      </div>
      <h3 class="text-xs uppercase tracking-wide text-muted mb-1">Sessions</h3>
      <div class="card divide-y divide-line">${sessions.map((r) => row(r, now)).join('')}</div>
      ${groups}
      <h3 class="text-xs uppercase tracking-wide text-muted mt-4 mb-1">News</h3>
      <div class="card text-sm text-muted flex items-center gap-2">${icon('Newspaper', 16)}No news synced yet.</div>`;
  };

  paint();
  const id = setInterval(paint, 1000);
  return () => clearInterval(id);
}

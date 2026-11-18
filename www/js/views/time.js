import { listSessions, listIctRanges } from '../data.js';
import { rangeState } from '../schedule.js';
import { formatDuration, formatInTz } from '../time.js';
import { appStore } from '../store.js';
import { icon } from '../icons.js';
import { esc } from '../ui.js';

const KIND_LABEL = { killzone: 'Killzones', silver_bullet: 'Silver Bullets', macro: 'Macros' };

function rowHtml(r, now) {
  const { active, next } = rangeState(r, now);
  if (active) {
    return `<span class="row win" style="gap:8px">${icon('Flame', 16)}<span style="color:var(--ink)">${esc(r.name)}</span></span>
      <span class="chip win">running ${formatDuration(now - active.start)}</span>`;
  }
  return `<span class="muted">${esc(r.name)}</span>
    <span class="chip">${next ? 'in ' + formatDuration(next.start - now) : '—'}</span>`;
}

export async function mount(el) {
  const [sessions, ict] = await Promise.all([listSessions(), listIctRanges()]);
  const tz = appStore.get('timeZone');
  const all = [...sessions.map((r) => ({ ...r, uid: 's' + r.id })), ...ict.map((r) => ({ ...r, uid: 'i' + r.id }))];
  const block = (list) => `<div class="card tight divided">${list.map((r) =>
    `<div class="row between" style="padding:10px 0" data-uid="${r.uid}"></div>`).join('')}</div>`;

  // Static structure is built once; each tick only updates the rows, so scrolling is never disturbed.
  el.innerHTML = `
    <div class="row between" style="margin-bottom:12px">
      <h1>Time</h1><span class="chip" id="clock"></span>
    </div>
    <h3 style="margin-top:0">Sessions</h3>${block(all.filter((r) => r.uid[0] === 's'))}
    ${Object.keys(KIND_LABEL).map((k) => `<h3>${KIND_LABEL[k]}</h3>${block(all.filter((r) => r.kind === k))}`).join('')}
    <h3>News</h3>
    <div class="card small muted row">${icon('Newspaper', 16)}No news synced yet.</div>`;

  const rows = new Map([...el.querySelectorAll('[data-uid]')].map((n) => [n.dataset.uid, n]));
  const clock = el.querySelector('#clock');

  const tick = () => {
    const now = Date.now();
    clock.innerHTML = icon('Globe', 14) + formatInTz(now, tz, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    for (const r of all) rows.get(r.uid).innerHTML = rowHtml(r, now);
  };
  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

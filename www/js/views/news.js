// News page. Rows come from the local `news` table, which the news sync fills once the API is connected.
import { listNews } from '../data.js';
import { appStore } from '../store.js';
import { zonedParts, wallToUtc, addDays, formatDuration, formatInTz } from '../time.js';
import { icon } from '../icons.js';
import { esc, flag, setHeader } from '../ui.js';

const RANGES = [{ id: 'today', label: 'Today' }, { id: 'week', label: 'This week' }];

function bounds(range, tz, now) {
  const p = zonedParts(now, tz);
  const start = range === 'today'
    ? { year: p.year, month: p.month, day: p.day }
    : addDays(p.year, p.month, p.day, -((p.weekday + 6) % 7));            // Monday
  const end = addDays(start.year, start.month, start.day, range === 'today' ? 1 : 7);
  const at = (d) => wallToUtc(d.year, d.month, d.day, 0, 0, tz);
  return [at(start), at(end)];
}

export async function mount(el) {
  setHeader({ title: 'News' });
  const tz = appStore.get('timeZone');
  let range = appStore.get('newsRange') ?? 'today';
  let timer;

  async function paint() {
    const now = Date.now();
    const [from, to] = bounds(range, tz, now);
    const rows = await listNews(from, to);
    const dayLabel = (ts) => formatInTz(ts, tz, { weekday: 'long', day: 'numeric', month: 'short' });
    let lastDay = '';

    el.innerHTML = `
      <div class="seg" id="nseg" style="margin-bottom:6px">
        ${RANGES.map((r) => `<button data-r="${r.id}" class="${r.id === range ? 'on' : ''}">${r.label}</button>`).join('')}
      </div>
      ${rows.length ? rows.map((n) => {
        const day = dayLabel(n.ts);
        const head = range === 'week' && day !== lastDay ? `<h3>${day}</h3>` : '';
        lastDay = day;
        const upcoming = n.ts > now;
        return `${head}
          <div class="card row" style="padding:9px 12px">
            <div style="width:46px" class="bold small">${formatInTz(n.ts, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}</div>
            <div class="grow">
              <div class="row" style="gap:6px">
                <span style="font-size:16px;line-height:1">${flag(n.country)}</span>
                <span class="loss" style="display:inline-flex">${icon('Folder', 15)}</span>
                <span class="bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(n.title)}</span>
              </div>
              <div class="row wrap" style="gap:5px;margin-top:5px">
                ${n.actual ? `<span class="chip win">A ${esc(n.actual)}</span>` : ''}
                ${n.forecast ? `<span class="chip info">F ${esc(n.forecast)}</span>` : ''}
                ${n.previous ? `<span class="chip">P ${esc(n.previous)}</span>` : ''}
              </div>
            </div>
            <span class="chip ${upcoming ? 'loss' : ''}" data-ts="${n.ts}">${upcoming ? 'in ' + formatDuration(n.ts - now) : 'done'}</span>
          </div>`;
      }).join('') : `
        <div class="card empty">
          ${icon('Newspaper', 34)}
          <b>No news ${range === 'today' ? 'today' : 'this week'}</b>
          <span class="small">Red-folder events will appear here once the news sync is connected.</span>
        </div>`}`;

    el.querySelector('#nseg').onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      range = b.dataset.r;
      appStore.set({ newsRange: range });
      paint();
    };
  }

  // countdown pills tick every second without repainting the list
  const tick = () => {
    const now = Date.now();
    el.querySelectorAll('[data-ts]').forEach((c) => {
      const ts = Number(c.dataset.ts);
      c.textContent = ts > now ? 'in ' + formatDuration(ts - now) : 'done';
      c.classList.toggle('loss', ts > now);
    });
  };

  await paint();
  timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}

// Dashboard > Weekly: P&L per weekday, week total, and the month total. Days are grouped by CLOSE time in your timezone.
import { appStore } from '../store.js';
import { tradesForStats } from '../data.js';
import { zonedParts, addDays } from '../time.js';
import { icon } from '../icons.js';
import { money } from '../ui.js';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const key = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fmt = (d, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(d.year, d.month - 1, d.day)));
const cls = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : 'muted');
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/** Pure: everything the screen needs for one week. Exported for tests. */
export function weekModel(trades, { tz, offset = 0, showSat = false, showSun = false, now = Date.now() }) {
  const byDay = new Map();
  for (const t of trades) {
    const p = zonedParts(t.close_time ?? t.open_time, tz);
    const k = key(p.year, p.month, p.day);
    const d = byDay.get(k) ?? { pnl: 0, n: 0, w: 0, l: 0, be: 0 };
    d.pnl += t.net_pnl; d.n++;
    t.result === 'win' ? d.w++ : t.result === 'loss' ? d.l++ : d.be++;
    byDay.set(k, d);
  }
  const today = zonedParts(now, tz);
  const mondayShift = (today.weekday + 6) % 7;
  const monday = addDays(today.year, today.month, today.day, -mondayShift + offset * 7);

  const days = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday.year, monday.month, monday.day, i);
    const stats = byDay.get(key(date.year, date.month, date.day)) ?? { pnl: 0, n: 0, w: 0, l: 0, be: 0 };
    const weekend = i >= 5;
    const show = !weekend || (i === 5 ? showSat : showSun) || stats.n > 0;   // weekend only when enabled or traded
    days.push({ date, name: DAY[(i + 1) % 7], ...stats, show });
  }
  const week = days.reduce((a, d) => ({ pnl: a.pnl + d.pnl, n: a.n + d.n, w: a.w + d.w, l: a.l + d.l, be: a.be + d.be }), { pnl: 0, n: 0, w: 0, l: 0, be: 0 });

  const mid = days[2].date;   // month of the week's Wednesday
  const month = { pnl: 0, n: 0 };
  for (const [k, d] of byDay) {
    const [y, m] = k.split('-').map(Number);
    if (y === mid.year && m === mid.month) { month.pnl += d.pnl; month.n += d.n; }
  }
  return { days, week, month, monthLabel: fmt(mid, { month: 'long', year: 'numeric' }), monday, sunday: days[6].date };
}

export async function renderWeekly(el) {
  const s = appStore.get('settings');
  const tz = appStore.get('timeZone');
  const trades = await tradesForStats(appStore.get('account').id);
  let offset = appStore.get('weekOffset') ?? 0;

  function paint() {
    const m = weekModel(trades, { tz, offset, showSat: s.show_saturday === '1', showSun: s.show_sunday === '1' });
    const shown = m.days.filter((d) => d.show);
    const max = Math.max(1, ...shown.map((d) => Math.abs(d.pnl)));
    const range = `${fmt(m.monday, { day: 'numeric', month: 'short' })} – ${fmt(m.sunday, { day: 'numeric', month: 'short', year: 'numeric' })}`;

    el.innerHTML = `
      <div class="card row between">
        <button class="iconbtn" id="wprev" aria-label="Previous week">${icon('ChevronLeft', 20)}</button>
        <div class="center">
          <div class="bold">${range}</div>
          <div class="tiny muted">${offset === 0 ? 'This week' : offset === -1 ? 'Last week' : `${-offset} weeks ago`}</div>
        </div>
        <button class="iconbtn" id="wnext" aria-label="Next week" ${offset >= 0 ? 'disabled style="opacity:.3"' : ''}>${icon('ChevronRight', 20)}</button>
      </div>

      <div class="card">
        <div class="tiles">
          <div class="tile"><div class="k">Week P&amp;L</div><div class="v ${cls(m.week.pnl)}">${money(m.week.pnl)}</div></div>
          <div class="tile"><div class="k">Trades</div><div class="v">${m.week.n}</div></div>
          <div class="tile"><div class="k">Win rate</div><div class="v">${pct(m.week.w, m.week.n)}%</div></div>
        </div>
        <div class="row wrap" style="gap:5px;margin-top:8px">
          <span class="chip win"><i class="dot"></i>${m.week.w} wins</span>
          <span class="chip loss"><i class="dot"></i>${m.week.l} losses</span>
          <span class="chip be"><i class="dot"></i>${m.week.be} BE</span>
        </div>
      </div>

      <div class="card">
        <div class="chart">
          ${shown.map((d) => `
            <div class="col">
              <div class="plot">${d.n ? `<div class="bar ${d.pnl >= 0 ? 'up' : 'down'}" style="height:${Math.max(2, (Math.abs(d.pnl) / max) * 50)}%"></div>` : ''}</div>
              <div class="lbl"><b>${d.name}</b>${d.date.day}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card tight divided">
        ${shown.map((d) => `
          <div class="row between" style="padding:9px 0">
            <div class="row" style="gap:8px">
              <span class="bold" style="width:34px">${d.name}</span>
              <span class="chip">${d.n} trade${d.n === 1 ? '' : 's'}</span>
              ${d.n ? `<span class="chip win">${d.w}W</span><span class="chip loss">${d.l}L</span>${d.be ? `<span class="chip be">${d.be}BE</span>` : ''}` : ''}
            </div>
            <span class="bold ${cls(d.pnl)}">${d.n ? money(d.pnl) : '—'}</span>
          </div>`).join('')}
        <div class="row between" style="padding:10px 0">
          <span class="bold">Week total</span>
          <span class="bold ${cls(m.week.pnl)}" style="font-size:16px">${money(m.week.pnl)}</span>
        </div>
      </div>

      <div class="card row between">
        <div>
          <div class="k">${m.monthLabel}</div>
          <div class="tiny muted" style="margin-top:2px">${m.month.n} trades this month</div>
        </div>
        <span class="bold ${cls(m.month.pnl)}" style="font-size:18px">${money(m.month.pnl)}</span>
      </div>`;

    el.querySelector('#wprev').onclick = () => { offset--; appStore.set({ weekOffset: offset }); paint(); };
    el.querySelector('#wnext').onclick = () => { if (offset < 0) { offset++; appStore.set({ weekOffset: offset }); paint(); } };
  }
  paint();
}

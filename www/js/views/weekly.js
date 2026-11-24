// Dashboard > Weekly: month calendar. Each day shows P&L, trades and win rate; each row has a week summary on the right.
// Days are grouped by CLOSE time in your timezone. Weeks start on Monday.
import { appStore } from '../store.js';
import { tradesForStats } from '../data.js';
import { zonedParts } from '../time.js';
import { icon } from '../icons.js';
import { money, esc, openSheet, tradeDate } from '../ui.js';

const NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const key = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayCls = (v, n) => (!n ? '' : v > 0 ? 'win' : v < 0 ? 'loss' : 'be');
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/** 1190 -> "$1.19K", -25 -> "-$25", 10.52 -> "$10.52" */
export function cash(n) {
  const a = Math.abs(n);
  const s = a >= 1000 ? `${(a / 1000).toFixed(2).replace(/\.?0+$/, '')}K` : Number.isInteger(a) ? String(a) : a.toFixed(2);
  return `${n < 0 ? '-' : ''}$${s}`;
}

/** Pure: everything the calendar needs for one month. Exported for tests. */
export function monthModel(trades, { tz, year, month, showSat = false, showSun = false, now = Date.now() }) {
  const byDay = new Map();
  for (const t of trades) {
    const p = zonedParts(t.close_time ?? t.open_time, tz);
    const k = key(p.year, p.month, p.day);
    const d = byDay.get(k) ?? { pnl: 0, n: 0, w: 0, l: 0, be: 0, list: [] };
    d.pnl += t.net_pnl; d.n++;
    t.result === 'win' ? d.w++ : t.result === 'loss' ? d.l++ : d.be++;
    d.list.push(t);
    byDay.set(k, d);
  }
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;   // Monday-first
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const today = zonedParts(now, tz);

  const rows = [];
  for (let r = 0; r < Math.ceil((lead + dim) / 7); r++) {
    const cells = [];
    const sum = { pnl: 0, n: 0, days: 0 };
    for (let c = 0; c < 7; c++) {
      const day = r * 7 + c - lead + 1;
      if (day < 1 || day > dim) { cells.push({ out: true }); continue; }
      const st = byDay.get(key(year, month, day)) ?? { pnl: 0, n: 0, w: 0, l: 0, be: 0, list: [] };
      cells.push({ day, ...st, today: today.year === year && today.month === month && today.day === day });
      sum.pnl += st.pnl; sum.n += st.n; if (st.n) sum.days++;
    }
    rows.push({ n: r + 1, cells, ...sum });
  }

  const inMonth = rows.flatMap((r) => r.cells).filter((c) => !c.out);
  const total = inMonth.reduce((a, c) => ({ pnl: a.pnl + c.pnl, n: a.n + c.n, w: a.w + c.w, l: a.l + c.l, be: a.be + c.be, days: a.days + (c.n ? 1 : 0) }),
    { pnl: 0, n: 0, w: 0, l: 0, be: 0, days: 0 });
  const hasOn = (col) => rows.some((r) => r.cells[col].n > 0);
  const cols = [0, 1, 2, 3, 4, ...(showSat || hasOn(5) ? [5] : []), ...(showSun || hasOn(6) ? [6] : [])];
  // A week whose only days fall in hidden weekend columns (e.g. a month starting on Sunday) is not shown.
  const visible = rows.filter((r) => cols.some((c) => !r.cells[c].out)).map((r, i) => ({ ...r, n: i + 1 }));
  return {
    rows: visible, cols, total, year, month,
    label: new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1))),
    isCurrent: today.year === year && today.month === month,
  };
}

function cellHtml(c) {
  if (c.out) return '<div class="cal-cell out"></div>';
  const cls = dayCls(c.pnl, c.n);
  return `<button class="cal-cell ${cls ? 'has ' + cls : ''} ${c.today ? 'today' : ''}" ${c.n ? `data-day="${c.day}"` : 'disabled'}>
    <span class="cal-d">${c.day}</span>
    ${c.n ? `<span class="cal-p ${cls}">${cash(c.pnl)}</span><span class="cal-s">${c.n} trade${c.n === 1 ? '' : 's'}</span><span class="cal-s">${pct(c.w, c.n)}%</span>` : ''}
  </button>`;
}

export async function renderWeekly(el) {
  const s = appStore.get('settings');
  const tz = appStore.get('timeZone');
  const trades = await tradesForStats(appStore.get('account').id);
  const nowP = zonedParts(Date.now(), tz);
  let cur = appStore.get('calMonth') ?? { year: nowP.year, month: nowP.month };

  function paint() {
    const m = monthModel(trades, { tz, year: cur.year, month: cur.month, showSat: s.show_saturday === '1', showSun: s.show_sunday === '1' });
    const n = m.cols.length;
    const tcls = dayCls(m.total.pnl, m.total.n);
    const atNow = cur.year === nowP.year && cur.month === nowP.month;

    el.innerHTML = `
      <div class="card">
        <div class="row between">
          <div class="row" style="gap:2px">
            <button class="iconbtn" id="mprev" aria-label="Previous month">${icon('ChevronLeft', 20)}</button>
            <button class="iconbtn" id="mnext" aria-label="Next month" ${atNow ? 'disabled style="opacity:.3"' : ''}>${icon('ChevronRight', 20)}</button>
          </div>
          <div class="bold" style="font-size:15px">${m.label}</div>
          ${atNow ? '<span style="width:76px"></span>' : '<button class="chip btn" id="mnow">This month</button>'}
        </div>
        <div class="row between wrap" style="gap:6px;margin-top:10px">
          <span class="small muted">Monthly stats</span>
          <span class="row" style="gap:5px">
            <span class="chip ${tcls}">${money(m.total.pnl)}</span>
            <span class="chip info">${m.total.days} day${m.total.days === 1 ? '' : 's'}</span>
          </span>
        </div>
      </div>

      <div class="card">
        <div class="tiles">
          <div class="tile"><div class="k">P&amp;L</div><div class="v ${tcls}">${money(m.total.pnl)}</div></div>
          <div class="tile"><div class="k">Trades</div><div class="v">${m.total.n}</div></div>
          <div class="tile"><div class="k">Win rate</div><div class="v">${pct(m.total.w, m.total.n)}%</div></div>
        </div>
        <div class="row wrap" style="gap:5px;margin-top:8px">
          <span class="chip win"><i class="dot"></i>${m.total.w} wins</span>
          <span class="chip loss"><i class="dot"></i>${m.total.l} losses</span>
          <span class="chip be"><i class="dot"></i>${m.total.be} BE</span>
        </div>
      </div>

      <div class="cal n${n}" style="--cols:${n}">
        ${m.cols.map((c) => `<div class="cal-h">${NAMES[c]}</div>`).join('')}<div class="cal-h"></div>
        ${m.rows.map((r) => `
          ${m.cols.map((c) => cellHtml(r.cells[c])).join('')}
          <div class="cal-w">
            <span class="tiny muted">Week ${r.n}</span>
            <span class="cal-wp ${dayCls(r.pnl, r.n)}">${r.n ? cash(r.pnl) : '$0'}</span>
            <span class="chip info">${r.days} day${r.days === 1 ? '' : 's'}</span>
          </div>`).join('')}
      </div>`;

    const go = (dm) => {
      const d = new Date(Date.UTC(cur.year, cur.month - 1 + dm, 1));
      cur = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
      appStore.set({ calMonth: cur });
      paint();
    };
    el.querySelector('#mprev').onclick = () => go(-1);
    el.querySelector('#mnext').onclick = () => { if (!atNow) go(1); };
    el.querySelector('#mnow')?.addEventListener('click', () => { cur = { year: nowP.year, month: nowP.month }; appStore.set({ calMonth: cur }); paint(); });

    el.querySelector('.cal').addEventListener('click', (e) => {
      const b = e.target.closest('[data-day]');
      if (!b) return;
      const cell = m.rows.flatMap((r) => r.cells).find((c) => String(c.day) === b.dataset.day);
      const { el: sheet, close } = openSheet(`
        <div class="row between" style="margin-bottom:8px">
          <h2 style="margin:0">${cell.day} ${esc(m.label)}</h2>
          <span class="chip ${dayCls(cell.pnl, cell.n)}">${money(cell.pnl)}</span>
        </div>
        ${cell.list.sort((a, b2) => a.close_time - b2.close_time).map((t) => {
          const c = t.result === 'win' ? 'win' : t.result === 'loss' ? 'loss' : 'be';
          return `<a class="card res-${c} row" href="#/trades/${t.id}">
            <div class="grow"><span class="bold">${esc(t.symbol)}</span>
              <span class="chip ${t.side === 'buy' ? 'win' : 'loss'}" style="margin-left:6px">${icon(t.side === 'buy' ? 'ArrowUpRight' : 'ArrowDownRight', 12)}${t.side === 'buy' ? 'Buy' : 'Sell'}</span>
              <div class="tiny muted" style="margin-top:3px">${tradeDate(t.close_time, tz)}</div></div>
            <span class="bold ${c}">${money(t.net_pnl)}</span></a>`;
        }).join('')}`);
      sheet.addEventListener('click', (ev) => { if (ev.target.closest('a')) close(); });
    });
  }
  paint();
}

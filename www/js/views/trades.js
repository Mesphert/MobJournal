import { appStore } from '../store.js';
import { countTrades, listTrades } from '../data.js';
import { icon } from '../icons.js';
import { money, tradeDate, symbolIconName, esc, setHeader, fmtHold } from '../ui.js';

const PAGE_SIZE = 20;
const RESULT = { win: ['WIN', 'win'], loss: ['LOSS', 'loss'], be: ['BE', 'be'] };

function tradeRow(t, tz) {
  const [label, cls] = RESULT[t.result] ?? RESULT.be;
  const buy = t.side === 'buy';
  return `
    <a class="card res-${cls} row" href="#/trades/${t.id}">
      <div class="icon-box">${icon(symbolIconName(t.symbol), 18)}</div>
      <div class="grow">
        <div class="row" style="gap:6px">
          <span class="bold">${esc(t.symbol)}</span>
          <span class="chip ${buy ? 'win' : 'loss'}">${icon(buy ? 'ArrowUpRight' : 'ArrowDownRight', 12)}${buy ? 'Buy' : 'Sell'}</span>
          ${t.quality ? `<span class="chip info">${icon('Star', 11)}${esc(t.quality)}</span>` : ''}
        </div>
        <div class="row wrap" style="gap:5px;margin-top:5px">
          <span class="chip">${icon('Clock', 11)}${tradeDate(t.open_time, tz)}</span>
          <span class="chip">${icon('Timer', 11)}${fmtHold(t.close_time - t.open_time)}</span>
        </div>
      </div>
      <div class="right">
        <div class="bold ${cls}" style="font-size:15px;margin-bottom:5px">${money(t.net_pnl)}</div>
        <span class="chip ${cls}"><i class="dot"></i>${label}</span>
      </div>
    </a>`;
}

export async function mount(el, { args = [] } = {}) {
  if (args[0] && args[1] === 'edit') return (await import('./trade-edit.js')).mountEdit(el, Number(args[0]));
  if (args[0]) return (await import('./trade-detail.js')).mountDetail(el, Number(args[0]));

  setHeader({ title: 'Trades', journal: true });
  let page = appStore.get('tradesPage') ?? 0;   // remembered when you come back from a trade
  const accountId = appStore.get('account').id;

  async function paint() {
    const tz = appStore.get('timeZone');
    const total = await countTrades(accountId);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    appStore.set({ tradesPage: page });
    const rows = total ? await listTrades({ accountId, limit: PAGE_SIZE, offset: page * PAGE_SIZE }) : [];

    el.innerHTML = total ? `
      <div class="small muted" style="margin:2px 2px 6px">${total} trades</div>
      ${rows.map((t) => tradeRow(t, tz)).join('')}
      ${pages > 1 ? `
        <div class="row between" style="margin-top:8px">
          <button id="prev" class="chip btn" ${page === 0 ? 'disabled' : ''}>${icon('ChevronLeft', 14)}Prev</button>
          <span class="tiny muted">Page ${page + 1} / ${pages}</span>
          <button id="next" class="chip btn" ${page >= pages - 1 ? 'disabled' : ''}>Next${icon('ChevronRight', 14)}</button>
        </div>` : ''}` : `
      <div class="card empty">
        ${icon('Inbox', 34)}
        <b>No trades in this journal yet</b>
        <span class="small">Import your MT5 history report from Settings.</span>
        <a class="chip accent btn" href="#/settings" style="text-decoration:none">${icon('Upload', 14)}Go to Settings</a>
      </div>`;

    el.querySelector('#prev')?.addEventListener('click', () => { page--; paint(); el.scrollTop = 0; });
    el.querySelector('#next')?.addEventListener('click', () => { page++; paint(); el.scrollTop = 0; });
  }
  await paint();
}

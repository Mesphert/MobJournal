import { appStore } from '../store.js';
import { importTrades, countTrades, listTrades } from '../data.js';
import { decodeReport, parseReport } from '../mt5-parser.js';
import { icon } from '../icons.js';
import { money, tradeDate, symbolIconName, toast, esc, setHeader, headerActions } from '../ui.js';

const PAGE_SIZE = 20;
const RESULT = { win: ['WIN', 'win'], loss: ['LOSS', 'loss'], be: ['BE', 'be'] };

function tradeRow(t, tz) {
  const [label, cls] = RESULT[t.result] ?? RESULT.be;
  const buy = t.side === 'buy';
  return `
    <a class="card row" href="#/trades/${t.id}" style="padding:12px 14px;margin-bottom:8px">
      <div class="icon-box">${icon(symbolIconName(t.symbol), 20)}</div>
      <div class="grow">
        <div class="row" style="gap:8px">
          <span class="bold">${esc(t.symbol)}</span>
          <span class="chip ${buy ? 'win' : 'loss'}">${icon(buy ? 'ArrowUpRight' : 'ArrowDownRight', 12)}${buy ? 'Buy' : 'Sell'}</span>
          ${t.quality ? `<span class="chip">${esc(t.quality)}</span>` : ''}
        </div>
        <div class="tiny muted" style="margin-top:2px">${tradeDate(t.open_time, tz)}</div>
      </div>
      <div class="right">
        <div class="bold ${cls}">${money(t.net_pnl)}</div>
        <div class="tiny bold ${cls}">${label}</div>
      </div>
    </a>`;
}

export async function mount(el, { args = [] } = {}) {
  if (args[0]) return (await import('./trade-detail.js')).mountDetail(el, Number(args[0]));

  setHeader({
    title: 'Trades',
    actions: `<button id="import" class="chip accent">${icon('Upload', 14)}Import</button>
              <input id="file" type="file" accept=".html,.htm,text/html" class="hide">`,
  });
  const bar = headerActions();
  let page = appStore.get('tradesPage') ?? 0;   // remembered when you come back from a trade

  async function paint() {
    const tz = appStore.get('timeZone');
    const total = await countTrades();
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    appStore.set({ tradesPage: page });
    const rows = total ? await listTrades({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }) : [];

    el.innerHTML = total ? `
      <div class="small muted" style="margin-bottom:10px">${total} trades</div>
      ${rows.map((t) => tradeRow(t, tz)).join('')}
      ${pages > 1 ? `
        <div class="row between" style="margin-top:12px">
          <button id="prev" class="chip btn" ${page === 0 ? 'disabled' : ''}>${icon('ChevronLeft', 16)}Prev</button>
          <span class="tiny muted">Page ${page + 1} / ${pages}</span>
          <button id="next" class="chip btn" ${page >= pages - 1 ? 'disabled' : ''}>Next${icon('ChevronRight', 16)}</button>
        </div>` : ''}` : `
      <div class="card empty">
        ${icon('Inbox', 36)}
        <b>No trades yet</b>
        <span class="small">Tap Import and choose your MT5 history report (HTML).</span>
      </div>`;

    el.querySelector('#prev')?.addEventListener('click', () => { page--; paint(); el.scrollTop = 0; });
    el.querySelector('#next')?.addEventListener('click', () => { page++; paint(); el.scrollTop = 0; });
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseReport(decodeReport(await file.arrayBuffer()));
      const { added, updated } = await importTrades(parsed, appStore.get('settings'));
      toast(`${added} new, ${updated} updated`);
      page = 0;
    } catch (err) {
      console.error(err);
      toast(err.message.length > 110 ? err.message.slice(0, 107) + '…' : err.message);
    }
    paint();
  }

  bar.querySelector('#import').onclick = () => bar.querySelector('#file').click();
  bar.querySelector('#file').onchange = onFile;
  await paint();
}

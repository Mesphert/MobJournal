import { appStore } from '../../core/store.js';
import { importTrades, countTrades, listTrades } from '../../data/repos/trades.js';
import { decodeReport, parseReport } from '../../services/mt5-parser.js';
import { icon } from '../../ui/icons.js';
import { money, tradeDate, symbolIconName } from '../../ui/format.js';
import { toast } from '../../ui/toast.js';

const PAGE_SIZE = 20;
const RESULT = {
  win:  { label: 'WIN',  cls: 'text-win' },
  loss: { label: 'LOSS', cls: 'text-loss' },
  be:   { label: 'BE',   cls: 'text-be' },
};

function tradeRow(t, tz) {
  const r = RESULT[t.result] ?? RESULT.be;
  const buy = t.side === 'buy';
  return `
    <div class="card flex items-center gap-3 mb-2 py-3">
      <div class="w-10 h-10 rounded-xl bg-surface2 flex items-center justify-center text-accent">${icon(symbolIconName(t.symbol), 20)}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium">${t.symbol}</span>
          <span class="chip ${buy ? 'text-win' : 'text-loss'}">${icon(buy ? 'ArrowUpRight' : 'ArrowDownRight', 12)}${buy ? 'Buy' : 'Sell'}</span>
        </div>
        <div class="text-xs text-muted mt-0.5">${tradeDate(t.open_time, tz)}</div>
      </div>
      <div class="text-right">
        <div class="font-semibold ${r.cls}">${money(t.net_pnl)}</div>
        <div class="text-[11px] font-medium ${r.cls}">${r.label}</div>
      </div>
    </div>`;
}

export async function mount(el) {
  let page = 0;

  async function paint() {
    const tz = appStore.get('timeZone');
    const total = await countTrades();
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    page = Math.min(page, pages - 1);
    const rows = total ? await listTrades({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }) : [];

    el.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-semibold">Trades <span class="text-sm text-muted font-normal">${total}</span></h1>
        <button id="import" class="chip !bg-accent text-white !px-3 !py-1.5">${icon('Upload', 14)}Import</button>
        <input id="file" type="file" accept=".html,.htm,text/html" class="hidden">
      </div>
      ${total ? rows.map((t) => tradeRow(t, tz)).join('') : `
        <div class="card flex flex-col items-center text-center gap-2 py-10 text-muted">
          ${icon('Inbox', 36)}
          <p class="text-ink font-medium">No trades yet</p>
          <p class="text-sm">Tap Import and choose your MT5 history report (HTML).</p>
        </div>`}
      ${pages > 1 ? `
        <div class="flex items-center justify-between mt-3">
          <button id="prev" class="chip !px-3 !py-2" ${page === 0 ? 'disabled style="opacity:.4"' : ''}>${icon('ChevronLeft', 16)}Prev</button>
          <span class="text-xs text-muted">Page ${page + 1} / ${pages}</span>
          <button id="next" class="chip !px-3 !py-2" ${page >= pages - 1 ? 'disabled style="opacity:.4"' : ''}>Next${icon('ChevronRight', 16)}</button>
        </div>` : ''}`;

    el.querySelector('#import').onclick = () => el.querySelector('#file').click();
    el.querySelector('#file').onchange = onFile;
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
      toast(err.message.length > 90 ? err.message.slice(0, 87) + '…' : err.message);
    }
    paint();
  }

  await paint();
}

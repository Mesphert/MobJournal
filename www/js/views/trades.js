import { appStore } from '../store.js';
import { importTrades, countTrades, listTrades, updateAccount } from '../data.js';
import { decodeReport, parseReport } from '../mt5-parser.js';
import { refreshAccounts, selectAccount } from '../accounts.js';
import { icon } from '../icons.js';
import { money, tradeDate, symbolIconName, toast, esc, setHeader, headerActions, fmtHold } from '../ui.js';

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
  if (args[0]) return (await import('./trade-detail.js')).mountDetail(el, Number(args[0]));

  setHeader({
    title: 'Trades', journal: true,
    actions: `<button id="import" class="chip accent btn">${icon('Upload', 14)}Import</button>
              <input id="file" type="file" accept=".html,.htm,text/html" class="hide">`,
  });
  const bar = headerActions();
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
        <span class="small">Tap Import and choose your MT5 history report (HTML).</span>
      </div>`;

    el.querySelector('#prev')?.addEventListener('click', () => { page--; paint(); el.scrollTop = 0; });
    el.querySelector('#next')?.addEventListener('click', () => { page++; paint(); el.scrollTop = 0; });
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseReport(decodeReport(await file.arrayBuffer()));
      const accounts = appStore.get('accounts');
      let target = appStore.get('account');
      const rid = parsed.account;

      // Route the report to the journal that owns that MT5 account.
      if (rid) {
        const match = accounts.find((a) => a.mt5_id === rid);
        if (match) target = match;
        else if (!target.mt5_id) {   // first report for this journal: remember its MT5 ID
          await updateAccount(target.id, { name: target.name, mt5Id: rid, startingBalance: target.starting_balance });
          await refreshAccounts(target.id);
        } else if (!confirm(`This report is for MT5 account ${rid}, but "${target.name}" is linked to ${target.mt5_id}.\nImport into "${target.name}" anyway?`)) {
          return;
        }
      }
      const { added, updated } = await importTrades(parsed, appStore.get('settings'), target.id);
      page = 0;
      appStore.set({ tradesPage: 0 });
      if (target.id !== appStore.get('account').id) {
        toast(`${added} new, ${updated} updated in "${target.name}"`);
        return selectAccount(target.id);        // switches the journal and re-renders
      }
      toast(`${added} new, ${updated} updated`);
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

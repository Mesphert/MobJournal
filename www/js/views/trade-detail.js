// Trade page: summary, the journal values you filled in, screenshots, and the automatic event timeline.
// The input form lives on its own page (trade-edit.js) behind the "Add more details" button.
import { appStore } from '../store.js';
import { getTrade, getJournal, listSessions, listIctRanges, listNews } from '../data.js';
import { CATEGORIES } from '../input-builder.js';
import { buildTimeline, timelineHtml } from '../timeline.js';
import { mountShots } from './shots.js';
import { icon } from '../icons.js';
import { esc, money, tradeDate, symbolIconName, setHeader, fmtHold } from '../ui.js';

const RESULT = { win: ['WIN', 'win'], loss: ['LOSS', 'loss'], be: ['BE', 'be'] };
const GROUPS = [
  ['Context', ['direction', 'bias', 'trade_type']],
  ['Setup', ['poi', 'setup_model', 'setup_pd']],
  ['Entry', ['entry_model', 'entry_pd', 'target']],
  ['Review', ['quality', 'discipline']],
];

export async function mountDetail(el, id) {
  setHeader({ title: 'Trade', back: '#/trades' });
  const trade = await getTrade(id);
  if (!trade) { el.innerHTML = '<div class="card empty"><b>Trade not found</b></div>'; return; }
  const tz = appStore.get('timeZone');
  const [j, sessions, ict, news] = await Promise.all([
    getJournal(id), listSessions(), listIctRanges(),
    listNews(trade.open_time - 3600e3, trade.close_time + 3600e3 + 1),
  ]);
  setHeader({ title: trade.symbol, back: '#/trades' });

  const buy = trade.side === 'buy';
  const [label, cls] = RESULT[trade.result] ?? RESULT.be;
  const stat = (k, v) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`;
  const num = (v) => (v == null ? '—' : v);

  const summary = `
    <div class="card res-${cls}">
      <div class="row">
        <div class="icon-box">${icon(symbolIconName(trade.symbol), 18)}</div>
        <div class="grow">
          <div class="bold" style="font-size:15px">${esc(trade.symbol)}</div>
          <div class="row wrap" style="gap:5px;margin-top:5px">
            <span class="chip ${buy ? 'win' : 'loss'}">${icon(buy ? 'ArrowUpRight' : 'ArrowDownRight', 12)}${buy ? 'Buy' : 'Sell'}</span>
            <span class="chip">${num(trade.volume)} lots</span>
            <span class="chip">${icon('Timer', 11)}${fmtHold(trade.close_time - trade.open_time)}</span>
            ${j.quality ? `<span class="chip info">${icon('Star', 11)}${esc(j.quality)}</span>` : ''}
          </div>
        </div>
        <div class="right">
          <div class="bold ${cls}" style="font-size:18px;margin-bottom:5px">${money(trade.net_pnl)}</div>
          <span class="chip ${cls}"><i class="dot"></i>${label}</span>
        </div>
      </div>
      <div class="grid2" style="margin-top:12px">
        ${stat('Opened', tradeDate(trade.open_time, tz))}
        ${stat('Closed', tradeDate(trade.close_time, tz))}
        ${stat('Entry', num(trade.open_price))}
        ${stat('Exit', num(trade.close_price))}
        ${stat('Stop / Target', `${num(trade.sl)} / ${num(trade.tp)}`)}
        ${stat('Commission / Swap', `${money(trade.commission)} / ${money(trade.swap)}`)}
      </div>
    </div>`;

  // ---- the values that have been filled in
  const groups = GROUPS.map(([title, fields]) => {
    const rows = fields.filter((f) => j[f]).map((f) => `
      <div class="kv"><span class="k">${CATEGORIES[f].label}</span>
        <span class="vals"><span class="chip ${f === 'discipline' && /breach/i.test(j[f]) ? 'loss' : 'info'}">${esc(j[f])}</span></span></div>`);
    return rows.length ? `<div class="sec-title" style="margin:10px 0 0">${title}</div><div class="divided">${rows.join('')}</div>` : '';
  }).join('');
  const mood = Number(j.mood) > 0
    ? `<div class="sec-title" style="margin:10px 0 0">Confidence</div>
       <div class="kv"><span class="k">Mood</span><span class="tag-stars">${icon('Star', 15).repeat(Number(j.mood))}</span></div>` : '';
  const notes = j.notes ? `<div class="sec-title" style="margin:10px 0 0">Notes</div><div class="note">${esc(j.notes)}</div>` : '';
  const filled = Boolean(groups || mood || notes);

  const journal = `
    <section class="card">
      <h2 style="margin-bottom:${filled ? 0 : 6}px">${icon('List', 16)}Journal</h2>
      ${filled ? groups + mood + notes : '<span class="small muted">No details added yet. Tap the button below to add the bias, setup, entry model and more.</span>'}
    </section>`;

  const timeline = `
    <section class="card tight" style="padding-bottom:2px">
      <h2 style="margin:12px 0 0">${icon('Clock', 16)}Timeline</h2>
      ${timelineHtml(buildTimeline({ trade, sessions, ict, news }), trade, tz)}
    </section>`;

  el.innerHTML = `
    ${summary}
    ${journal}
    <section class="card hide" id="shotsCard"><h2>${icon('ImagePlus', 16)}Screenshots</h2><div id="shots"></div></section>
    ${timeline}
    <a class="chip accent btn" href="#/trades/${id}/edit" style="width:100%;height:42px;justify-content:center;font-size:14px;margin:2px 0 8px">
      ${icon(filled ? 'Pencil' : 'Plus', 16)}${filled ? 'Edit details' : 'Add more details'}
    </a>`;

  const n = await mountShots(el.querySelector('#shots'), id, { editable: false });
  if (n) el.querySelector('#shotsCard').classList.remove('hide');
}

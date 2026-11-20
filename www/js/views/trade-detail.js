import { appStore } from '../store.js';
import { getTrade, getJournal, saveJournalField, loadInputState, listTfs, listShots } from '../data.js';
import {
  CATEGORIES, FILTERED, MANAGED, DISCIPLINE_BREACH, buildOptions, allowedSign, filterOptions, withCurrent,
} from '../input-builder.js';
import { saveScreenshot, shotSrc, removeShot } from '../screenshots.js';
import { icon } from '../icons.js';
import {
  esc, money, tradeDate, symbolIconName, setHeader, headerActions, starsHtml, fmtHold, toast,
} from '../ui.js';

const RESULT = { win: ['WIN', 'win'], loss: ['LOSS', 'loss'], be: ['BE', 'be'] };
const GROUPS = [
  { title: 'Context', fields: ['direction', 'bias', 'trade_type'], hint: true },
  { title: 'Setup', fields: ['poi', 'setup_model', 'setup_pd'] },
  { title: 'Entry', fields: ['entry_model', 'entry_pd', 'target'] },
];

export async function mountDetail(el, id) {
  setHeader({ title: 'Trade', back: '#/trades' });
  const trade = await getTrade(id);
  if (!trade) {
    el.innerHTML = `<div class="card empty"><b>Trade not found</b></div>`;
    return;
  }
  const [state, journal, tfList] = await Promise.all([loadInputState(MANAGED), getJournal(id), listTfs()]);
  const settings = appStore.get('settings');
  const tz = appStore.get('timeZone');
  const j = { ...journal };

  setHeader({ title: trade.symbol, back: '#/trades', actions: '<span class="chip win hide" id="saved">Saved</span>' });

  // Loss beyond the per-trade limit pre-fills the discipline field (only when still empty).
  const maxLoss = Number(settings.max_loss_per_trade) || 0;
  const breached = maxLoss > 0 && trade.net_pnl < -maxLoss;
  if (breached && !j.discipline) {
    j.discipline = DISCIPLINE_BREACH;
    await saveJournalField(id, 'discipline', DISCIPLINE_BREACH);
  }

  // ---------- option lists ----------
  const optionsFor = (cat) => {
    let opts = buildOptions(cat, { values: state.values[cat] ?? [], enabledTfs: state.enabledTfs });
    if (FILTERED.includes(cat)) opts = filterOptions(opts, allowedSign(j.bias, j.trade_type));
    return withCurrent(opts, j[cat]);
  };
  const optionsHtml = (cat) => '<option value="">—</option>' + optionsFor(cat).map((o) =>
    `<option value="${esc(o.label)}" ${o.label === j[cat] ? 'selected' : ''}>${esc(o.label)}${o.stale ? ' (not in list)' : ''}</option>`).join('');
  const selectHtml = (cat) => `
    <label class="label">${CATEGORIES[cat].label}
      <select class="field" data-f="${cat}">${optionsHtml(cat)}</select>
    </label>`;
  const hintText = () => {
    const s = allowedSign(j.bias, j.trade_type);
    return s ? `Showing ${s === '+' ? 'bullish (+)' : 'bearish (−)'} options only: ${j.trade_type} + ${j.bias}.`
             : 'Pick bias and trade type to filter the options below.';
  };

  // ---------- summary ----------
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

  const form = GROUPS.map((g) => `
    <section class="card stack">
      <h2 style="margin-bottom:0">${g.title}</h2>
      ${g.fields.map(selectHtml).join('')}
      ${g.hint ? `<span class="hint" id="filterHint">${hintText()}</span>` : ''}
    </section>`).join('');

  const review = `
    <section class="card stack">
      <h2 style="margin-bottom:0">Review</h2>
      ${selectHtml('quality')}
      <div>${selectHtml('discipline')}
        ${breached ? `<span class="hint">This loss is beyond your max per trade (${maxLoss}).</span>` : ''}</div>
      <div><span class="label">Mood / confidence</span>${starsHtml(j.mood)}</div>
      <label class="label">Notes
        <textarea class="field" data-f="notes" placeholder="What did you see, what would you change?">${esc(j.notes ?? '')}</textarea>
      </label>
    </section>`;

  const defTf = tfList.find((t) => t.enabled && t.tf === '15m')?.tf ?? tfList.find((t) => t.enabled)?.tf;
  const shotsCard = `
    <section class="card">
      <h2 style="margin-bottom:0">${icon('ImagePlus', 18)}Screenshots</h2>
      <div class="row" style="margin-top:12px">
        <select id="shotTf" class="field" style="margin:0;width:auto">
          ${tfList.filter((t) => t.enabled).map((t) => `<option ${t.tf === defTf ? 'selected' : ''}>${t.tf}</option>`).join('')}
        </select>
        <button id="addShot" class="chip accent btn">${icon('Plus', 14)}Add</button>
        <input id="shotFile" type="file" accept="image/*" multiple class="hide">
      </div>
      <div id="shots"></div>
    </section>`;

  el.innerHTML = summary + form + review + shotsCard;

  // ---------- saving ----------
  let savedTimer;
  const flashSaved = () => {
    const chip = headerActions()?.querySelector('#saved');
    if (!chip) return;
    chip.classList.remove('hide');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => chip.classList.add('hide'), 1200);
  };
  const save = async (field, value) => {
    j[field] = value === '' ? null : value;
    await saveJournalField(id, field, value);
    flashSaved();
  };

  const refreshFiltered = () => {
    for (const cat of FILTERED) {
      const s = el.querySelector(`[data-f="${cat}"]`);
      if (s) s.innerHTML = optionsHtml(cat);
    }
    el.querySelector('#filterHint').textContent = hintText();
  };

  el.addEventListener('change', async (e) => {
    const f = e.target.dataset?.f;
    if (!f) return;
    await save(f, e.target.value);
    if (f === 'bias' || f === 'trade_type') refreshFiltered();
  });

  el.addEventListener('click', async (e) => {
    const star = e.target.closest('[data-star]');
    if (!star) return;
    const n = Number(star.dataset.star);
    const next = Number(j.mood) === n ? null : n;
    await save('mood', next === null ? '' : next);
    el.querySelector('#stars').outerHTML = starsHtml(next);
  });

  // ---------- screenshots ----------
  const shotsEl = el.querySelector('#shots');
  async function paintShots() {
    const rows = await listShots(id);
    shotsEl.innerHTML = rows.length
      ? `<div class="shots">${rows.map((r) => `<button class="shot" data-shot="${r.id}"><img alt=""><span>${esc(r.tf)}</span></button>`).join('')}</div>`
      : '<span class="hint">No screenshots yet. Pick a timeframe, tap Add and choose images from your gallery.</span>';
    rows.forEach((r) => {
      const img = shotsEl.querySelector(`[data-shot="${r.id}"] img`);
      shotSrc(r.file_path).then((src) => { img.src = src; }).catch((err) => console.warn(err));
    });
    shotsEl._rows = rows;
  }

  el.querySelector('#addShot').onclick = () => el.querySelector('#shotFile').click();
  el.querySelector('#shotFile').onchange = async (e) => {
    const files = [...(e.target.files ?? [])];
    const tf = el.querySelector('#shotTf').value;
    try {
      for (const f of files) await saveScreenshot(id, tf, f);
      if (files.length) toast(`${files.length} screenshot${files.length > 1 ? 's' : ''} added`);
    } catch (err) {
      console.error(err);
      toast('Could not save screenshot: ' + err.message);
    }
    e.target.value = '';
    paintShots();
  };

  shotsEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-shot]');
    if (!b) return;
    const row = shotsEl._rows.find((r) => String(r.id) === b.dataset.shot);
    const viewer = document.createElement('div');
    viewer.className = 'viewer';
    viewer.innerHTML = `
      <div class="bar2"><span class="bold">${esc(row.tf)}</span>
        <span class="row"><button class="iconbtn" data-del style="color:#fff">${icon('Trash2', 22)}</button>
        <button class="iconbtn" data-close style="color:#fff">${icon('X', 24)}</button></span></div>
      <img alt="">`;
    document.body.appendChild(viewer);
    shotSrc(row.file_path).then((src) => { viewer.querySelector('img').src = src; }).catch((err) => console.warn(err));
    viewer.addEventListener('click', async (ev) => {
      if (ev.target.closest('[data-close]')) viewer.remove();
      if (ev.target.closest('[data-del]') && confirm('Delete this screenshot?')) {
        await removeShot(row);
        viewer.remove();
        paintShots();
      }
    });
  });

  await paintShots();
}

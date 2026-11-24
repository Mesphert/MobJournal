// "Add more details": the journal form for one trade. Everything saves as you change it.
import { appStore } from '../store.js';
import { getTrade, getJournal, saveJournalField, loadInputState, listTfs } from '../data.js';
import {
  CATEGORIES, FILTERED, MANAGED, DISCIPLINE_BREACH, buildOptions, allowedSign, filterOptions, withCurrent,
} from '../input-builder.js';
import { mountShots } from './shots.js';
import { esc, setHeader, headerActions, starsHtml, selectHtml, updateSelect } from '../ui.js';
import { icon } from '../icons.js';

const GROUPS = [
  { title: 'Context', fields: ['direction', 'bias', 'trade_type'], hint: true },
  { title: 'Setup', fields: ['poi', 'setup_model', 'setup_pd'] },
  { title: 'Entry', fields: ['entry_model', 'entry_pd', 'target'] },
];

export async function mountEdit(el, id) {
  setHeader({ title: 'Details', back: `#/trades/${id}` });
  const trade = await getTrade(id);
  if (!trade) { el.innerHTML = '<div class="card empty"><b>Trade not found</b></div>'; return; }
  const [state, journal, tfList] = await Promise.all([loadInputState(MANAGED), getJournal(id), listTfs()]);
  const settings = appStore.get('settings');
  const j = { ...journal };
  setHeader({ title: 'Details', back: `#/trades/${id}`, actions: '<span class="chip win hide" id="saved">Saved</span>' });

  // A loss beyond the per-trade limit pre-fills discipline (only while it is still empty).
  const maxLoss = Number(settings.max_loss_per_trade) || 0;
  const breached = maxLoss > 0 && trade.net_pnl < -maxLoss;
  if (breached && !j.discipline) {
    j.discipline = DISCIPLINE_BREACH;
    await saveJournalField(id, 'discipline', DISCIPLINE_BREACH);
  }

  // ---------- options ----------
  const optionsFor = (cat) => {
    let opts = buildOptions(cat, { values: state.values[cat] ?? [], enabledTfs: state.enabledTfs });
    if (FILTERED.includes(cat)) opts = filterOptions(opts, allowedSign(j.bias, j.trade_type));
    return withCurrent(opts, j[cat]).map((o) => ({ value: o.label, label: o.label + (o.stale ? ' (not in list)' : '') }));
  };
  const field = (cat) => `
    <div><span class="label">${CATEGORIES[cat].label}</span>
      ${selectHtml({ f: cat, value: j[cat] ?? '', options: optionsFor(cat), title: CATEGORIES[cat].label, clearable: true })}
    </div>`;
  const hintText = () => {
    const s = allowedSign(j.bias, j.trade_type);
    return s ? `Showing ${s === '+' ? 'bullish (+)' : 'bearish (−)'} options only: ${j.trade_type} + ${j.bias}.`
             : 'Pick bias and trade type to filter the options below.';
  };

  el.innerHTML = `
    ${GROUPS.map((g) => `
      <section class="card stack">
        <h2 style="margin-bottom:0">${g.title}</h2>
        ${g.fields.map(field).join('')}
        ${g.hint ? `<span class="hint" id="filterHint">${hintText()}</span>` : ''}
      </section>`).join('')}
    <section class="card stack">
      <h2 style="margin-bottom:0">Review</h2>
      ${field('quality')}
      <div>${field('discipline')}
        ${breached ? `<span class="hint">This loss is beyond your max per trade (${maxLoss}).</span>` : ''}</div>
      <div><span class="label">Mood / confidence</span>${starsHtml(j.mood)}</div>
      <label class="label">Notes
        <textarea class="field" data-f="notes" placeholder="What did you see, what would you change?">${esc(j.notes ?? '')}</textarea>
      </label>
    </section>
    <section class="card">
      <h2>${icon('ImagePlus', 18)}Screenshots</h2>
      <div id="shots"></div>
    </section>`;

  // ---------- saving ----------
  let savedTimer;
  const flashSaved = () => {
    const chip = headerActions()?.querySelector('#saved');
    if (!chip) return;
    chip.classList.remove('hide');
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => chip.classList.add('hide'), 1200);
  };
  const save = async (f, value) => {
    j[f] = value === '' ? null : value;
    await saveJournalField(id, f, value);
    flashSaved();
  };
  const refreshFiltered = () => {
    for (const cat of FILTERED) {
      const btn = el.querySelector(`[data-f="${cat}"]`);
      if (btn) updateSelect(btn, { options: optionsFor(cat), value: j[cat] ?? '' });
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

  const enabled = tfList.filter((t) => t.enabled).map((t) => t.tf);
  await mountShots(el.querySelector('#shots'), id, { editable: true, tfs: enabled, defTf: enabled.includes('15m') ? '15m' : enabled[0] });
}

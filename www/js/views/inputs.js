import { listTfs, setTfEnabled, loadInputState, addValue, updateValue, deleteValue } from '../data.js';
import { CATEGORIES, MANAGED } from '../input-builder.js';
import { icon } from '../icons.js';
import { esc, toast, setHeader, openSheet } from '../ui.js';

const NOTES = {
  discipline: `"Breached max loss per trade" is filled in automatically when a loss goes beyond your limit in Settings.`,
};

export async function mount(el) {
  setHeader({ title: 'Trade inputs', back: '#/settings' });
  let tfs = [], state = { enabledTfs: [], values: {} };

  async function paint() {
    const y = el.scrollTop;
    tfs = await listTfs();
    state = await loadInputState(MANAGED);
    const enabled = new Set(state.enabledTfs);

    const card = (cat) => {
      const c = CATEGORIES[cat];
      const list = state.values[cat];
      return `
        <section class="card">
          <h2 style="margin-bottom:${c.polar ? 4 : 8}px">${c.label}</h2>
          ${c.polar ? '<span class="hint" style="margin:0 0 8px">Each value creates a + and a − option for every timeframe it uses.</span>' : ''}
          ${NOTES[cat] ? `<span class="hint" style="margin:0 0 8px">${NOTES[cat]}</span>` : ''}
          ${list.length ? `<div class="divided">${list.map((v) => `
            <div class="row" style="padding:8px 0">
              <div class="grow">
                <div>${esc(v.name)}</div>
                ${c.tf ? `<div class="tiny muted">${v.tfs ? esc(v.tfs.filter((t) => enabled.has(t)).join(' ') || 'no enabled timeframes') : 'All timeframes'}</div>` : ''}
              </div>
              <button class="iconbtn" data-edit="${cat}:${v.id}" aria-label="Edit">${icon('Pencil', 18)}</button>
              <button class="iconbtn" data-del="${v.id}" aria-label="Delete">${icon('Trash2', 18)}</button>
            </div>`).join('')}</div>` : '<span class="hint" style="margin:0">Nothing here yet.</span>'}
          <div class="row" style="margin-top:12px">
            <input class="field" style="margin:0" placeholder="Add value" data-add="${cat}">
            <button class="chip accent btn" data-addbtn="${cat}">${icon('Plus', 14)}Add</button>
          </div>
        </section>`;
    };

    el.innerHTML = `
      <section class="card">
        <h2 style="margin-bottom:4px">Timeframes</h2>
        <span class="hint" style="margin:0 0 12px">Turn off the ones you never use. They disappear from every dropdown.</span>
        <div class="chips">${tfs.map((t) => `<button class="chip btn ${t.enabled ? 'on' : ''}" data-tf="${t.tf}">${t.tf}</button>`).join('')}</div>
      </section>
      ${MANAGED.map(card).join('')}`;
    el.scrollTop = y;
  }

  function openEdit(cat, v) {
    const c = CATEGORIES[cat];
    const on = new Set(v.tfs ?? state.enabledTfs);
    const { el: sheet, close } = openSheet(`
      <h2>Edit ${esc(c.label)}</h2>
      <label class="label">Name<input class="field" id="en" value="${esc(v.name)}"></label>
      ${c.tf ? `<div class="sec-title">Timeframes</div>
        <div class="chips" id="etfs">${state.enabledTfs.map((t) => `<button type="button" class="chip btn ${on.has(t) ? 'on' : ''}" data-tf="${t}">${t}</button>`).join('')}</div>` : ''}
      <div class="row" style="margin-top:20px">
        <button class="chip btn grow" id="ecancel" style="justify-content:center">Cancel</button>
        <button class="chip accent btn grow" id="esave" style="justify-content:center">Save</button>
      </div>`);
    sheet.querySelector('#etfs')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tf]');
      if (!b) return;
      on.has(b.dataset.tf) ? on.delete(b.dataset.tf) : on.add(b.dataset.tf);
      b.classList.toggle('on');
    });
    sheet.querySelector('#ecancel').onclick = close;
    sheet.querySelector('#esave').onclick = async () => {
      let tfsOut = null;
      if (c.tf) {
        const chosen = state.enabledTfs.filter((t) => on.has(t));
        if (!chosen.length) return toast('Select at least one timeframe');
        tfsOut = chosen.length === state.enabledTfs.length ? null : chosen;   // all = follow the enabled list
      }
      try { await updateValue(v.id, sheet.querySelector('#en').value, tfsOut); close(); await paint(); }
      catch (err) { toast(err.message); }
    };
  }

  const add = async (cat) => {
    const input = el.querySelector(`[data-add="${cat}"]`);
    try { await addValue(cat, input.value); await paint(); }
    catch (err) { toast(err.message); }
  };

  el.addEventListener('click', async (e) => {
    const tf = e.target.closest('[data-tf]');
    if (tf) { await setTfEnabled(tf.dataset.tf, !tf.classList.contains('on')); return paint(); }
    const addBtn = e.target.closest('[data-addbtn]');
    if (addBtn) return add(addBtn.dataset.addbtn);
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const [cat, id] = edit.dataset.edit.split(':');
      return openEdit(cat, state.values[cat].find((v) => String(v.id) === id));
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const cat = MANAGED.find((c) => state.values[c].some((v) => String(v.id) === del.dataset.del));
      const v = state.values[cat].find((x) => String(x.id) === del.dataset.del);
      if (confirm(`Delete "${v.name}"? Trades that already use it keep their saved value.`)) { await deleteValue(v.id); await paint(); }
    }
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.dataset?.add) { e.preventDefault(); add(e.target.dataset.add); }
  });

  await paint();
}

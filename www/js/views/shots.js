// Screenshot gallery for one trade. editable = true adds the timeframe picker + Add button.
import { listShots } from '../data.js';
import { saveScreenshot, shotSrc, removeShot } from '../screenshots.js';
import { icon } from '../icons.js';
import { esc, toast, selectHtml } from '../ui.js';

export async function mountShots(el, tradeId, { editable = false, tfs = [], defTf } = {}) {
  el.innerHTML = `
    ${editable ? `
      <div class="row" style="margin-bottom:2px">
        <div style="width:96px;flex:none">${selectHtml({ attrs: 'id="shotTf"', value: defTf ?? tfs[0] ?? '', options: tfs.map((t) => ({ value: t, label: t })), title: 'Timeframe' })}</div>
        <button id="addShot" class="chip accent btn">${icon('Plus', 14)}Add screenshots</button>
        <input id="shotFile" type="file" accept="image/*" multiple class="hide">
      </div>` : ''}
    <div id="shotGrid"></div>`;
  const grid = el.querySelector('#shotGrid');
  let rows = [];

  async function paint() {
    rows = await listShots(tradeId);
    grid.innerHTML = rows.length
      ? `<div class="shots">${rows.map((r) => `<button class="shot" data-shot="${r.id}"><img alt=""><span>${esc(r.tf)}</span></button>`).join('')}</div>`
      : editable ? '<span class="hint">No screenshots yet. Pick a timeframe, tap Add and choose images from your gallery.</span>' : '';
    rows.forEach((r) => {
      const img = grid.querySelector(`[data-shot="${r.id}"] img`);
      shotSrc(r.file_path).then((src) => { img.src = src; }).catch((err) => console.warn(err));
    });
    return rows.length;
  }

  if (editable) {
    el.querySelector('#addShot').onclick = () => el.querySelector('#shotFile').click();
    el.querySelector('#shotFile').onchange = async (e) => {
      const files = [...(e.target.files ?? [])];
      const tf = el.querySelector('#shotTf').value;
      try {
        for (const f of files) await saveScreenshot(tradeId, tf, f);
        if (files.length) toast(`${files.length} screenshot${files.length > 1 ? 's' : ''} added`);
      } catch (err) {
        console.error(err);
        toast('Could not save screenshot: ' + err.message);
      }
      e.target.value = '';
      paint();
    };
  }

  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-shot]');
    if (!b) return;
    const row = rows.find((r) => String(r.id) === b.dataset.shot);
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
        paint();
      }
    });
  });

  return paint();
}

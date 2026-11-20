import { appStore } from '../store.js';
import { renderWeekly } from './weekly.js';

const TABS = ['Overview', 'Weekly', 'Risk', 'Timing', 'Instruments'];
const READY = { Weekly: renderWeekly };   // the rest arrive with the analytics library

export function mount(el) {
  let cur = appStore.get('dashTab') ?? 'Weekly';
  el.innerHTML = `
    <div class="seg" id="dtabs" style="margin-bottom:6px">
      ${TABS.map((t) => `<button data-t="${t}" class="${t === cur ? 'on' : ''}">${t}</button>`).join('')}
    </div>
    <div id="dbody"></div>`;
  const body = el.querySelector('#dbody');

  const show = async (t) => {
    cur = t;
    appStore.set({ dashTab: t });
    el.querySelectorAll('#dtabs button').forEach((x) => x.classList.toggle('on', x.dataset.t === t));
    if (READY[t]) await READY[t](body);
    else body.innerHTML = `<div class="card small muted">${t}: analytics library not integrated yet.</div>`;
  };
  el.querySelector('#dtabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) show(b.dataset.t);
  });
  return show(cur);
}

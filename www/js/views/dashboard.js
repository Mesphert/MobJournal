const TABS = ['Overview', 'Weekly', 'Risk', 'Timing', 'Instruments'];

export function mount(el) {
  el.innerHTML = `
    <h1 style="margin-bottom:12px">Dashboard</h1>
    <div class="seg" id="dtabs" style="margin-bottom:16px">
      ${TABS.map((t, i) => `<button data-i="${i}" class="${i === 0 ? 'on' : ''}">${t}</button>`).join('')}
    </div>
    <div id="dbody" class="card small muted">Analytics library not integrated yet.</div>`;
  el.querySelector('#dtabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('#dtabs button').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('#dbody').textContent = `${TABS[b.dataset.i]}: analytics library not integrated yet.`;
  });
}

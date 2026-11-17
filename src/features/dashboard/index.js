const TABS = ['Overview', 'Weekly', 'Risk', 'Timing', 'Instruments'];

export function mount(el) {
  el.innerHTML = `
    <h1 class="text-xl font-semibold mb-3">Dashboard</h1>
    <div class="seg mb-4 overflow-x-auto" id="dtabs">
      ${TABS.map((t, i) => `<button data-i="${i}" class="${i === 0 ? 'on' : ''} px-3 whitespace-nowrap">${t}</button>`).join('')}
    </div>
    <div id="dbody" class="card text-sm text-muted">Analytics library not integrated yet.</div>`;
  el.querySelector('#dtabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('#dtabs button').forEach((x) => x.classList.toggle('on', x === b));
    el.querySelector('#dbody').textContent = `${TABS[b.dataset.i]}: analytics library not integrated yet.`;
  });
}

import { icon } from '../../ui/icons.js';

export function mount(el) {
  el.innerHTML = `
    <h1 class="text-xl font-semibold mb-4">Trades</h1>
    <div class="card flex flex-col items-center text-center gap-2 py-10 text-muted">
      ${icon('Inbox', 36)}
      <p class="text-ink font-medium">No trades yet</p>
      <p class="text-sm">Trade import and the journal form come next.</p>
    </div>`;
}

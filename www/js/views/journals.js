import { appStore } from '../store.js';
import { accountStats } from '../data.js';
import { refreshAccounts, openJournalForm, removeJournal } from '../accounts.js';
import { removeShotFile } from '../screenshots.js';
import { icon } from '../icons.js';
import { esc, plain, setHeader, toast } from '../ui.js';

export async function mount(el) {
  setHeader({ title: 'Journals', back: '#/settings', actions: `<button id="newj" class="chip accent btn">${icon('Plus', 14)}New</button>` });

  async function paint() {
    const stats = await accountStats();
    const cur = appStore.get('account');
    const accounts = appStore.get('accounts');
    el.innerHTML = accounts.map((a) => {
      const s = stats.get(a.id) ?? { count: 0, net: 0 };
      return `
        <div class="card">
          <div class="row">
            <div class="icon-box">${icon('BookOpen', 18)}</div>
            <div class="grow">
              <div class="row" style="gap:6px"><span class="bold">${esc(a.name)}</span>${a.id === cur.id ? '<span class="chip win"><i class="dot"></i>Active</span>' : ''}</div>
              <div class="row wrap" style="gap:5px;margin-top:5px">
                ${a.mt5_id ? `<span class="chip info">${icon('Hash', 11)}${esc(a.mt5_id)}</span>` : '<span class="chip">No MT5 ID</span>'}
                <span class="chip">${icon('Wallet', 11)}Start ${plain(a.starting_balance)}</span>
                <span class="chip ${s.net > 0 ? 'win' : s.net < 0 ? 'loss' : ''}">Balance ${plain(a.starting_balance + s.net)}</span>
                <span class="chip">${s.count} trades</span>
              </div>
            </div>
            <button class="iconbtn" data-edit="${a.id}" aria-label="Edit">${icon('Pencil', 18)}</button>
            <button class="iconbtn" data-del="${a.id}" aria-label="Delete">${icon('Trash2', 18)}</button>
          </div>
        </div>`;
    }).join('');
  }

  el.addEventListener('click', async (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) {
      const a = appStore.get('accounts').find((x) => String(x.id) === edit.dataset.edit);
      return openJournalForm(a, async () => { await refreshAccounts(); await paint(); });
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const a = appStore.get('accounts').find((x) => String(x.id) === del.dataset.del);
      const n = (await accountStats()).get(a.id)?.count ?? 0;
      if (!confirm(`Delete "${a.name}" with its ${n} trades, notes and screenshots?\nThis cannot be undone.`)) return;
      await removeJournal(a, removeShotFile);
      toast('Journal deleted');
    }
  });
  document.getElementById('newj').onclick = () => openJournalForm(null, async () => { await refreshAccounts(); await paint(); toast('Journal created'); });

  await paint();
}

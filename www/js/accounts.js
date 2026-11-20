// Journals (trading accounts): current selection, switcher sheet, create/edit form.
import { appStore } from './store.js';
import { listAccounts, accountStats, createAccount, updateAccount, deleteAccount, accountShotPaths, saveSetting } from './data.js';
import { icon } from './icons.js';
import { esc, plain, toast, openSheet } from './ui.js';

export const changed = () => window.dispatchEvent(new Event('accountchange'));

/** Reload the journal list and make sure `account` points at a real one. */
export async function refreshAccounts(preferId) {
  const accounts = await listAccounts();
  const want = Number(preferId ?? appStore.get('settings').current_account_id);
  const account = accounts.find((a) => a.id === want) ?? accounts[0] ?? null;
  appStore.set({ accounts, account });
  if (account && String(account.id) !== appStore.get('settings').current_account_id) {
    await saveSetting('current_account_id', account.id);
    appStore.set({ settings: { ...appStore.get('settings'), current_account_id: String(account.id) } });
  }
  return account;
}

export async function selectAccount(id) {
  await refreshAccounts(id);
  changed();
}

// ---------- create / edit form (bottom sheet) ----------
const formFields = (a = {}) => `
  <label class="label">Journal name
    <input class="field" id="jn" placeholder="e.g. FundedNext 25k" value="${esc(a.name ?? '')}" maxlength="40">
  </label>
  <label class="label">MT5 account ID <span class="tiny">(optional)</span>
    <input class="field" id="jm" inputmode="numeric" placeholder="e.g. 12000822" value="${esc(a.mt5_id ?? '')}">
  </label>
  <label class="label">Starting balance
    <input class="field" id="jb" type="number" step="any" inputmode="decimal" placeholder="0.00" value="${a.starting_balance ?? ''}">
  </label>`;

const readForm = (root) => ({
  name: root.querySelector('#jn').value,
  mt5Id: root.querySelector('#jm').value,
  startingBalance: root.querySelector('#jb').value === '' ? 0 : root.querySelector('#jb').value,
});

/** Opens the form. onDone(id) runs after saving. */
export function openJournalForm(existing = null, onDone = () => {}) {
  const { el, close } = openSheet(`
    <h2>${existing ? 'Edit journal' : 'New journal'}</h2>
    <div class="stack">${formFields(existing ?? {})}
      <div class="row">
        <button class="chip btn grow" id="jc" style="justify-content:center">Cancel</button>
        <button class="chip accent btn grow" id="js" style="justify-content:center">${existing ? 'Save' : 'Create'}</button>
      </div>
    </div>`);
  el.querySelector('#jc').onclick = close;
  el.querySelector('#js').onclick = async () => {
    try {
      const data = readForm(el);
      let id = existing?.id;
      if (existing) await updateAccount(existing.id, data); else id = await createAccount(data);
      close();
      await onDone(id);
    } catch (err) { toast(err.message); }
  };
}

/** First run: nothing exists yet, so the journal is created on a full page. */
export function mountOnboarding(el, onCreated) {
  el.innerHTML = `
    <div class="card stack" style="margin-top:12px">
      <h2 style="margin:0">${icon('BookOpen', 18)}Create your first journal</h2>
      <span class="hint" style="margin:0">One journal per trading account. You can add more later and switch from the header.</span>
      ${formFields()}
      <button class="chip accent btn" id="jgo" style="justify-content:center">Create journal</button>
    </div>`;
  el.querySelector('#jgo').onclick = async () => {
    try {
      const id = await createAccount(readForm(el));
      await onCreated(id);
    } catch (err) { toast(err.message); }
  };
}

// ---------- switcher (opened from the header) ----------
export async function openSwitcher() {
  const [accounts, stats] = [appStore.get('accounts'), await accountStats()];
  const cur = appStore.get('account');
  const { el, close } = openSheet(`
    <h2>Journals</h2>
    ${accounts.map((a) => {
      const bal = a.starting_balance + (stats.get(a.id)?.net ?? 0);
      return `<button class="pick ${a.id === cur?.id ? 'on' : ''}" data-id="${a.id}">
        <div class="grow">
          <div class="bold">${esc(a.name)}</div>
          <div class="row wrap" style="gap:5px;margin-top:4px">
            ${a.mt5_id ? `<span class="chip info">${icon('Hash', 11)}${esc(a.mt5_id)}</span>` : ''}
            <span class="chip">${icon('Wallet', 11)}${plain(bal)}</span>
            <span class="chip">${stats.get(a.id)?.count ?? 0} trades</span>
          </div>
        </div>${a.id === cur?.id ? icon('Check', 18) : ''}
      </button>`;
    }).join('')}
    <div class="row" style="margin-top:10px">
      <a class="chip btn grow" href="#/settings/journals" id="manage" style="justify-content:center;text-decoration:none">Manage</a>
      <button class="chip accent btn grow" id="addj" style="justify-content:center">${icon('Plus', 14)}New journal</button>
    </div>`);
  el.addEventListener('click', async (e) => {
    const pick = e.target.closest('[data-id]');
    if (pick) { close(); await selectAccount(Number(pick.dataset.id)); }
  });
  el.querySelector('#manage').addEventListener('click', close);
  el.querySelector('#addj').onclick = () => { close(); openJournalForm(null, async (id) => { await selectAccount(id); }); };
}

/** Delete a journal and everything in it (screenshot files included). */
export async function removeJournal(account, removeFile) {
  for (const p of await accountShotPaths(account.id)) { try { await removeFile(p); } catch (e) { console.warn(e); } }
  await deleteAccount(account.id);
  await refreshAccounts();
  changed();
}

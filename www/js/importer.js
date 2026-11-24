// MT5 history import: pick a file, route it to the right journal, save. Used by Settings and the post-create prompt.
import { appStore } from './store.js';
import { importTrades, updateAccount, listAccounts } from './data.js';
import { decodeReport, parseReport } from './mt5-parser.js';
import { refreshAccounts, selectAccount, changed } from './accounts.js';
import { toast, openSheet, esc } from './ui.js';

/** Imports one report file. preferId = journal to use when the report does not point elsewhere. */
export async function importFile(file, preferId) {
  try {
    const parsed = parseReport(decodeReport(await file.arrayBuffer()));
    const accounts = appStore.get('accounts');
    const current = appStore.get('account');
    let target = accounts.find((a) => a.id === preferId) ?? current;
    const rid = parsed.account;

    // Route the report to the journal that owns that MT5 account.
    if (rid) {
      const match = accounts.find((a) => a.mt5_id === rid);
      if (match) target = match;
      else if (!target.mt5_id) {   // first report for this journal: remember its MT5 ID
        await updateAccount(target.id, { name: target.name, mt5Id: rid, startingBalance: target.starting_balance });
        await refreshAccounts(current.id);
      } else if (!confirm(`This report is for MT5 account ${rid}, but "${target.name}" is linked to ${target.mt5_id}.\nImport into "${target.name}" anyway?`)) {
        return null;
      }
    }
    const { added, updated } = await importTrades(parsed, appStore.get('settings'), target.id);
    appStore.set({ tradesPage: 0 });
    toast(target.id === current.id ? `${added} new, ${updated} updated` : `${added} new, ${updated} updated in "${target.name}"`);
    if (target.id !== current.id) await selectAccount(target.id); else changed();
    return { added, updated, journal: target };
  } catch (err) {
    console.error(err);
    toast(err.message.length > 110 ? err.message.slice(0, 107) + '…' : err.message);
    return null;
  }
}

/** Opens the system file picker (must be called from a tap) and imports the chosen report. */
export function chooseAndImport(preferId) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm,text/html';
    input.className = 'hide';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      resolve(file ? await importFile(file, preferId) : null);
    };
    document.body.appendChild(input);
    input.click();
  });
}

/** Shown right after a journal is created: reminds the user to import their MT5 history. */
export async function promptImport(accountId) {
  const acct = (await listAccounts()).find((a) => a.id === accountId);
  if (!acct) return;
  const { el, close } = openSheet(`
    <h2>Import your trades</h2>
    <p class="small muted" style="margin:0 0 12px;line-height:1.5">
      Journal <b style="color:var(--ink)">${esc(acct.name)}</b> is ready. Export your history from MT5
      (History tab, right-click, Report, HTML) and import the file now. You can also do it later in Settings.
    </p>
    <div class="row">
      <button class="chip btn grow" id="later" style="justify-content:center">Later</button>
      <button class="chip accent btn grow" id="now" style="justify-content:center">Import now</button>
    </div>`);
  el.querySelector('#later').onclick = close;
  el.querySelector('#now').onclick = () => { close(); chooseAndImport(accountId); };
}

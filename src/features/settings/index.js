import { appStore } from '../../core/store.js';
import { systemTimeZone } from '../../core/time.js';
import { saveSetting } from '../../data/repos/settings.js';
import { recomputeDerived } from '../../data/repos/trades.js';
import { applyTheme } from '../../ui/theme.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';

const THEMES = [
  { id: 'system', label: 'System', icon: 'Smartphone' },
  { id: 'light', label: 'Light', icon: 'Sun' },
  { id: 'dark', label: 'Dark', icon: 'Moon' },
];

// Changing these re-derives trade UTC times / win-loss-be
const RECOMPUTE_KEYS = new Set(['broker_time_mode', 'broker_utc_offset', 'be_threshold']);

function zones() {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch { return ['UTC', 'Africa/Addis_Ababa', 'America/New_York', 'Europe/London', 'Asia/Tokyo']; }
}

const num = (label, key, s, hint = '') => `
  <label class="block">
    <span class="text-xs text-muted">${label}</span>
    <input class="field mt-1" type="number" step="any" inputmode="decimal" data-num="${key}" value="${s[key]}">
    ${hint ? `<span class="text-[11px] text-muted">${hint}</span>` : ''}
  </label>`;

const toggle = (label, key, s) => `
  <label class="flex items-center justify-between py-2">
    <span>${label}</span>
    <input type="checkbox" class="w-5 h-5 accent-[rgb(var(--accent))]" data-bool="${key}" ${s[key] === '1' ? 'checked' : ''}>
  </label>`;

export function mount(el) {
  const s = appStore.get('settings');
  const sys = systemTimeZone();

  el.innerHTML = `
    <h1 class="text-xl font-semibold mb-4">Settings</h1>

    <section class="card mb-3">
      <h2 class="flex items-center gap-2 font-medium mb-3">${icon('Sun', 18)}Theme</h2>
      <div class="seg" id="themeSeg">
        ${THEMES.map((t) => `<button data-theme="${t.id}" class="${s.theme === t.id ? 'on' : ''}">${icon(t.icon, 16)}${t.label}</button>`).join('')}
      </div>
    </section>

    <section class="card mb-3">
      <h2 class="flex items-center gap-2 font-medium mb-3">${icon('Globe', 18)}Timezone</h2>
      <select class="field" id="tz">
        <option value="">System default (${sys})</option>
        ${zones().map((z) => `<option value="${z}" ${s.timezone === z ? 'selected' : ''}>${z}</option>`).join('')}
      </select>
    </section>

    <section class="card mb-3 space-y-3">
      <h2 class="flex items-center gap-2 font-medium">${icon('Clock', 18)}MT5 server time</h2>
      <select class="field" id="brokerMode">
        <option value="ny_close" ${s.broker_time_mode === 'ny_close' ? 'selected' : ''}>New York close (GMT+2 winter / GMT+3 summer)</option>
        <option value="fixed" ${s.broker_time_mode === 'fixed' ? 'selected' : ''}>Fixed UTC offset (no DST)</option>
      </select>
      <div id="offsetWrap" class="${s.broker_time_mode === 'fixed' ? '' : 'hidden'}">
        ${num('UTC offset (hours)', 'broker_utc_offset', s)}
      </div>
      <p class="text-[11px] text-muted">Used to convert the report's times to real time. Changing it re-calculates all trades.</p>
    </section>

    <section class="card mb-3 space-y-3">
      <h2 class="flex items-center gap-2 font-medium">${icon('ShieldAlert', 18)}Risk limits</h2>
      ${num('Max trades per day', 'max_trades_per_day', s)}
      ${num('Max loss per day ($)', 'max_loss_per_day', s)}
      ${num('Max loss per trade ($)', 'max_loss_per_trade', s)}
      ${num('Breakeven range (± $)', 'be_threshold', s, 'Net P&L within this range counts as BE.')}
    </section>

    <section class="card mb-3">
      <h2 class="flex items-center gap-2 font-medium mb-1">${icon('CalendarDays', 18)}Weekly table</h2>
      ${toggle('Always show Saturday', 'show_saturday', s)}
      ${toggle('Always show Sunday', 'show_sunday', s)}
      <p class="text-xs text-muted">Weekend columns also appear automatically when a trade exists on those days.</p>
    </section>`;

  const update = async (key, value) => {
    await saveSetting(key, value);
    appStore.set({ settings: { ...appStore.get('settings'), [key]: String(value) } });
    if (RECOMPUTE_KEYS.has(key)) {
      await recomputeDerived(appStore.get('settings'));
      toast('Saved, trades recalculated');
    } else {
      toast('Saved');
    }
  };

  el.querySelector('#themeSeg').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    el.querySelectorAll('#themeSeg button').forEach((x) => x.classList.toggle('on', x === b));
    applyTheme(b.dataset.theme);
    await update('theme', b.dataset.theme);
  });

  el.querySelector('#tz').addEventListener('change', async (e) => {
    await update('timezone', e.target.value);
    appStore.set({ timeZone: e.target.value || sys });
  });

  el.querySelector('#brokerMode').addEventListener('change', async (e) => {
    el.querySelector('#offsetWrap').classList.toggle('hidden', e.target.value !== 'fixed');
    await update('broker_time_mode', e.target.value);
  });

  el.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.num) await update(t.dataset.num, t.value === '' ? 0 : t.value);
    if (t.dataset.bool) await update(t.dataset.bool, t.checked ? '1' : '0');
  });
}

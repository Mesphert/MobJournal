import { appStore } from '../../core/store.js';
import { systemTimeZone } from '../../core/time.js';
import { saveSetting } from '../../data/repos/settings.js';
import { applyTheme } from '../../ui/theme.js';
import { toast } from '../../ui/toast.js';
import { icon } from '../../ui/icons.js';

const THEMES = [
  { id: 'system', label: 'System', icon: 'Smartphone' },
  { id: 'light', label: 'Light', icon: 'Sun' },
  { id: 'dark', label: 'Dark', icon: 'Moon' },
];

function zones() {
  try { return Intl.supportedValuesOf('timeZone'); }
  catch { return ['UTC', 'Africa/Addis_Ababa', 'America/New_York', 'Europe/London', 'Asia/Tokyo']; }
}

const num = (label, key, s) => `
  <label class="block">
    <span class="text-xs text-muted">${label}</span>
    <input class="field mt-1" type="number" min="0" step="any" inputmode="decimal" data-num="${key}" value="${s[key]}">
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
      <h2 class="flex items-center gap-2 font-medium">${icon('ShieldAlert', 18)}Risk limits</h2>
      ${num('Max trades per day', 'max_trades_per_day', s)}
      ${num('Max loss per day ($)', 'max_loss_per_day', s)}
      ${num('Max loss per trade ($)', 'max_loss_per_trade', s)}
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
    toast('Saved');
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

  el.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.dataset.num) await update(t.dataset.num, t.value === '' ? 0 : t.value);
    if (t.dataset.bool) await update(t.dataset.bool, t.checked ? '1' : '0');
  });
}

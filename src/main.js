import './styles/main.css';
import { openDb } from './core/db.js';
import { appStore } from './core/store.js';
import { systemTimeZone } from './core/time.js';
import { seedDefaults } from './data/seed.js';
import { loadSettings } from './data/repos/settings.js';
import { applyTheme, watchSystemTheme } from './ui/theme.js';
import { startRouter } from './core/router.js';

async function boot() {
  try {
    await openDb();
    await seedDefaults();
    const settings = await loadSettings();
    appStore.set({ settings, timeZone: settings.timezone || systemTimeZone() });
    applyTheme(settings.theme);
    watchSystemTheme(() => appStore.get('settings').theme);
    startRouter();
  } catch (err) {
    console.error(err);
    document.getElementById('view').innerHTML =
      `<div class="card text-loss">Startup failed:<br><code>${String(err?.message ?? err)}</code></div>`;
  }
}

boot();

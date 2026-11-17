import { all, run } from '../../core/db.js';

export const SETTING_DEFAULTS = {
  theme: 'system',            // system | light | dark
  timezone: '',               // '' = system timezone
  max_trades_per_day: '3',
  max_loss_per_day: '100',
  max_loss_per_trade: '50',
  show_saturday: '0',
  show_sunday: '0',
};

export async function loadSettings() {
  const rows = await all('SELECT key, value FROM settings');
  const out = { ...SETTING_DEFAULTS };
  for (const { key, value } of rows) out[key] = value;
  return out;
}

export async function saveSetting(key, value) {
  await run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}

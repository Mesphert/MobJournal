import { wallToUtc } from '../core/time.js';

const RAW = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/**
 * MT5 server wall-clock string -> UTC ms.
 * mode 'ny_close': server time = New York time + 7h (GMT+2 winter / GMT+3 summer, follows US DST).
 * mode 'fixed'   : server time = UTC + offsetHours, no DST.
 */
export function brokerToUtc(raw, { mode = 'ny_close', offsetHours = 2 } = {}) {
  const m = RAW.exec(raw ?? '');
  if (!m) return null;
  const [Y, Mo, D, h, mi, s] = m.slice(1).map(Number);
  if (mode === 'fixed') return Date.UTC(Y, Mo - 1, D, h, mi, s) - offsetHours * 3600000;
  const ny = new Date(Date.UTC(Y, Mo - 1, D, h, mi, s) - 7 * 3600000);
  return wallToUtc(
    ny.getUTCFullYear(), ny.getUTCMonth() + 1, ny.getUTCDate(),
    ny.getUTCHours(), ny.getUTCMinutes(), 'America/New_York',
  ) + s * 1000;
}

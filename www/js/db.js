// Thin bridge to the native JournalDb plugin (Android's built-in SQLite). No JS SQLite library.
import { MIGRATIONS } from './migrations.js';

function plugin() {
  const p = window.Capacitor?.Plugins?.JournalDb;
  if (!p) throw new Error('Native JournalDb plugin not found. Open the app on the phone, not in a browser.');
  return p;
}

export async function all(sql, params = []) {
  return (await plugin().query({ sql, params })).rows;
}
export async function get(sql, params = []) {
  return (await all(sql, params))[0] ?? null;
}
export async function run(sql, params = []) {
  return (await plugin().run({ sql, params })).changes;
}
/** Atomic: statements = [{ sql, params }] */
export async function batch(statements) {
  if (statements.length) await plugin().batch({ statements });
}

const splitSql = (text) => text.split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean);

export async function openDb() {
  await run('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER)');
  const done = new Set((await all('SELECT id FROM _migrations')).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await batch([
      ...splitSql(m.sql).map((sql) => ({ sql, params: [] })),
      { sql: 'INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)', params: [m.id, m.name, Date.now()] },
    ]);
  }
}

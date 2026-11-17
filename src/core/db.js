import { Capacitor } from '@capacitor/core';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { MIGRATIONS } from './migrations.js';

const DB_NAME = 'mobjournal';
const sqlite = new SQLiteConnection(CapacitorSQLite);
const isWeb = Capacitor.getPlatform() === 'web';
let db = null;

async function initWebStore() {
  const { defineCustomElements } = await import('jeep-sqlite/loader');
  defineCustomElements(window);
  const el = document.createElement('jeep-sqlite');
  document.body.appendChild(el);
  await customElements.whenDefined('jeep-sqlite');
  await sqlite.initWebStore();
}

async function persist() {
  if (isWeb) await sqlite.saveToStore(DB_NAME);
}

async function migrate() {
  await db.execute('CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER);');
  const done = new Set((await db.query('SELECT id FROM _migrations')).values.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.execute(m.sql);
    await db.run('INSERT INTO _migrations (id, name, applied_at) VALUES (?, ?, ?)', [m.id, m.name, Date.now()]);
  }
}

export async function openDb() {
  if (db) return db;
  if (isWeb) await initWebStore();

  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  db = consistent && exists
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  await db.execute('PRAGMA foreign_keys = ON;');
  await migrate();
  await persist();
  return db;
}

// ---- Query helpers (the only place repos should touch the plugin) ----
export async function all(sql, params = []) {
  return (await db.query(sql, params)).values ?? [];
}
export async function get(sql, params = []) {
  return (await all(sql, params))[0] ?? null;
}
export async function run(sql, params = []) {
  const res = await db.run(sql, params);
  await persist();
  return res.changes;
}
/** Atomic batch: sets = [{ statement, values }] */
export async function batch(sets) {
  await db.executeSet(sets, true);
  await persist();
}

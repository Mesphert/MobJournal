// Append-only list. Never edit a shipped migration; add a new one.
export const MIGRATIONS = [
  {
    id: 1,
    name: 'initial schema',
    sql: `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket TEXT UNIQUE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  volume REAL,
  open_time INTEGER,
  close_time INTEGER,
  open_price REAL,
  close_price REAL,
  sl REAL,
  tp REAL,
  commission REAL DEFAULT 0,
  swap REAL DEFAULT 0,
  profit REAL DEFAULT 0,
  net_pnl REAL DEFAULT 0,
  result TEXT,
  source TEXT DEFAULT 'mt5-import',
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_trades_open ON trades(open_time);

CREATE TABLE IF NOT EXISTS trade_journal (
  trade_id INTEGER PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
  direction TEXT,
  bias TEXT,
  trade_type TEXT,
  poi TEXT,
  setup_model TEXT,
  setup_pd TEXT,
  entry_model TEXT,
  entry_pd TEXT,
  target TEXT,
  quality TEXT,
  discipline TEXT,
  mood INTEGER,
  notes TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS trade_screenshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trade_id INTEGER NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  tf TEXT,
  file_path TEXT NOT NULL,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS trade_enrichment (
  trade_id INTEGER PRIMARY KEY REFERENCES trades(id) ON DELETE CASCADE,
  entry_session TEXT,
  exit_session TEXT,
  entry_ict TEXT,
  exit_ict TEXT,
  news_json TEXT,
  computed_at INTEGER
);

CREATE TABLE IF NOT EXISTS tf_enabled (
  tf TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS input_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  tfs TEXT,
  UNIQUE(category, name)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  tz TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '1,2,3,4,5',
  color TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ict_ranges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  tz TEXT NOT NULL,
  start TEXT NOT NULL,
  end TEXT NOT NULL,
  days TEXT NOT NULL DEFAULT '1,2,3,4,5',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  ts INTEGER NOT NULL,
  country TEXT,
  title TEXT NOT NULL,
  impact TEXT,
  forecast TEXT,
  actual TEXT,
  previous TEXT
);
CREATE INDEX IF NOT EXISTS idx_news_ts ON news(ts);
`,
  },
  {
    id: 2,
    name: 'trades: raw broker times + account',
    sql: `
ALTER TABLE trades ADD COLUMN open_raw TEXT;
ALTER TABLE trades ADD COLUMN close_raw TEXT;
ALTER TABLE trades ADD COLUMN account TEXT;
`,
  },
];

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  layer INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 25,
  receipt_qr_value TEXT NOT NULL,
  print_status TEXT NOT NULL DEFAULT 'queued',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS system_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  request_id TEXT,
  level TEXT NOT NULL,
  module TEXT NOT NULL,
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  file TEXT NOT NULL,
  func TEXT NOT NULL,
  line INTEGER NOT NULL,
  method TEXT,
  path TEXT,
  stack TEXT,
  data TEXT,
  created_at INTEGER NOT NULL
);

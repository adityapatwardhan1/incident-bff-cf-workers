CREATE TABLE IF NOT EXISTS circuit_state (
  origin TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
  failure_count INTEGER NOT NULL DEFAULT 0,
  opened_at INTEGER,
  updated_at INTEGER NOT NULL
);

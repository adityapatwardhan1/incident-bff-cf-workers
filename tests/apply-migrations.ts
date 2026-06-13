import { env } from "cloudflare:test";

await env.DB.prepare(
  `CREATE TABLE IF NOT EXISTS circuit_state (
    origin TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    failure_count INTEGER NOT NULL DEFAULT 0,
    opened_at INTEGER,
    updated_at INTEGER NOT NULL
  )`,
).run();

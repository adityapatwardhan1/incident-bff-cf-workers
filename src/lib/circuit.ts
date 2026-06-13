import type { OriginId } from "./origins";

export type CircuitStateName = "closed" | "open" | "half_open";

interface CircuitRow {
  origin: string;
  state: CircuitStateName;
  failure_count: number;
  opened_at: number | null;
  updated_at: number;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function failureThreshold(env: Env): number {
  const n = Number.parseInt(env.CIRCUIT_FAILURE_THRESHOLD ?? "3", 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export function openSeconds(env: Env): number {
  const n = Number.parseInt(env.CIRCUIT_OPEN_SECONDS ?? "30", 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function getRow(env: Env, origin: OriginId): Promise<CircuitRow | null> {
  return env.DB.prepare(
    "SELECT origin, state, failure_count, opened_at, updated_at FROM circuit_state WHERE origin = ?",
  )
    .bind(origin)
    .first<CircuitRow>();
}

export async function getEffectiveState(
  env: Env,
  origin: OriginId,
): Promise<CircuitStateName> {
  const row = await getRow(env, origin);
  if (!row) {
    return "closed";
  }

  if (row.state === "open" && row.opened_at !== null) {
    const elapsed = nowSeconds() - row.opened_at;
    if (elapsed >= openSeconds(env)) {
      const ts = nowSeconds();
      await env.DB.prepare(
        "UPDATE circuit_state SET state = 'half_open', updated_at = ? WHERE origin = ?",
      )
        .bind(ts, origin)
        .run();
      return "half_open";
    }
  }

  return row.state;
}

export async function shouldSkipFetch(env: Env, origin: OriginId): Promise<boolean> {
  const state = await getEffectiveState(env, origin);
  return state === "open";
}

export async function recordSuccess(env: Env, origin: OriginId): Promise<void> {
  const ts = nowSeconds();
  await env.DB.prepare(
    `INSERT INTO circuit_state (origin, state, failure_count, opened_at, updated_at)
     VALUES (?, 'closed', 0, NULL, ?)
     ON CONFLICT(origin) DO UPDATE SET
       state = 'closed',
       failure_count = 0,
       opened_at = NULL,
       updated_at = excluded.updated_at`,
  )
    .bind(origin, ts)
    .run();
}

export async function recordFailure(env: Env, origin: OriginId): Promise<void> {
  const threshold = failureThreshold(env);
  const ts = nowSeconds();
  const effective = await getEffectiveState(env, origin);

  if (effective === "half_open") {
    await env.DB.prepare(
      `INSERT INTO circuit_state (origin, state, failure_count, opened_at, updated_at)
       VALUES (?, 'open', ?, ?, ?)
       ON CONFLICT(origin) DO UPDATE SET
         state = 'open',
         failure_count = excluded.failure_count,
         opened_at = excluded.opened_at,
         updated_at = excluded.updated_at`,
    )
      .bind(origin, threshold, ts, ts)
      .run();
    return;
  }

  const row = await getRow(env, origin);
  const nextCount = (row?.failure_count ?? 0) + 1;

  if (nextCount >= threshold) {
    await env.DB.prepare(
      `INSERT INTO circuit_state (origin, state, failure_count, opened_at, updated_at)
       VALUES (?, 'open', ?, ?, ?)
       ON CONFLICT(origin) DO UPDATE SET
         state = 'open',
         failure_count = excluded.failure_count,
         opened_at = excluded.opened_at,
         updated_at = excluded.updated_at`,
    )
      .bind(origin, nextCount, ts, ts)
      .run();
    return;
  }

  await env.DB.prepare(
    `INSERT INTO circuit_state (origin, state, failure_count, opened_at, updated_at)
     VALUES (?, 'closed', ?, NULL, ?)
     ON CONFLICT(origin) DO UPDATE SET
       state = 'closed',
       failure_count = excluded.failure_count,
       opened_at = NULL,
       updated_at = excluded.updated_at`,
  )
    .bind(origin, nextCount, ts)
    .run();
}

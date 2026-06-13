import type { OriginId } from "./origins";

export interface CachedSlice {
  data: unknown;
  cachedAt: number;
  ttlSeconds: number;
}

export function cacheKey(origin: OriginId, incidentId: string): string {
  return `cache:${origin}:${incidentId}`;
}

export function ttlForOrigin(env: Env, origin: OriginId): number {
  if (env.SLICE_TTL_SECONDS) {
    return Number.parseInt(env.SLICE_TTL_SECONDS, 10);
  }
  if (origin === "docs-api") {
    const docsTtl = env.DOCS_SLICE_TTL_SECONDS ?? "3600";
    return Number.parseInt(docsTtl, 10);
  }
  return 60;
}

async function readCachedSlice(
  env: Env,
  origin: OriginId,
  incidentId: string,
): Promise<CachedSlice | null> {
  const raw = await env.SLICE_CACHE.get(cacheKey(origin, incidentId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as CachedSlice;
}

export function staleMaxSeconds(env: Env, origin: OriginId): number {
  if (origin === "metrics-api" && env.METRICS_STALE_MAX_SECONDS) {
    const n = Number.parseInt(env.METRICS_STALE_MAX_SECONDS, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  if (env.STALE_MAX_SECONDS) {
    const n = Number.parseInt(env.STALE_MAX_SECONDS, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 300;
}

export async function getFreshSlice(
  env: Env,
  origin: OriginId,
  incidentId: string,
): Promise<unknown | null> {
  const entry = await readCachedSlice(env, origin, incidentId);
  if (!entry) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (entry.cachedAt + entry.ttlSeconds <= now) {
    return null;
  }

  return entry.data;
}

export async function getStaleSlice(
  env: Env,
  origin: OriginId,
  incidentId: string,
): Promise<unknown | null> {
  const entry = await readCachedSlice(env, origin, incidentId);
  if (!entry) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const freshUntil = entry.cachedAt + entry.ttlSeconds;
  if (now <= freshUntil) {
    return null;
  }

  const staleUntil = entry.cachedAt + staleMaxSeconds(env, origin);
  if (now > staleUntil) {
    return null;
  }

  return entry.data;
}

export async function putSlice(
  env: Env,
  origin: OriginId,
  incidentId: string,
  data: unknown,
  ttlSeconds: number,
): Promise<void> {
  const entry: CachedSlice = {
    data,
    cachedAt: Math.floor(Date.now() / 1000),
    ttlSeconds,
  };
  await env.SLICE_CACHE.put(cacheKey(origin, incidentId), JSON.stringify(entry));
}

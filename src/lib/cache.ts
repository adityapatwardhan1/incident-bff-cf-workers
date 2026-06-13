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

export async function getFreshSlice(
  env: Env,
  origin: OriginId,
  incidentId: string,
): Promise<unknown | null> {
  const raw = await env.SLICE_CACHE.get(cacheKey(origin, incidentId));
  if (!raw) {
    return null;
  }

  const cached = JSON.parse(raw) as CachedSlice;
  const now = Math.floor(Date.now() / 1000);
  if (cached.cachedAt + cached.ttlSeconds <= now) {
    return null;
  }

  return cached.data;
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

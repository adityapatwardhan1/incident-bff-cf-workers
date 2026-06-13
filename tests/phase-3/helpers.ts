import {
  createExecutionContext,
  createMessageBatch,
  env,
  getQueueResult,
  waitOnExecutionContext,
} from "cloudflare:test";
import type { ExportedHandler } from "@cloudflare/workers-types";
import { metricsFixture } from "../../src/lib/fixtures";
import { cacheKey, getFreshSlice, type CachedSlice } from "../../src/lib/cache";
import worker from "../../src/index";

const BASE = "http://example.com";
const handler = worker as ExportedHandler<Env, import("../../src/lib/refresh-queue").RefreshMessage>;

export async function resetCircuitState(): Promise<void> {
  await env.DB.prepare("DELETE FROM circuit_state").run();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function exhaustMetricsRateLimit(
  incidentId = "INC-RATEBURST",
): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await workerFetch(`/mock/metrics-api/${incidentId}`);
  }
}

export async function workerFetch(
  pathname: string,
  envOverrides: Partial<Env> = {},
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(`${BASE}${pathname}`, init);
  const ctx = createExecutionContext();
  const response = await handler.fetch!(request, { ...env, ...envOverrides }, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export async function workerJson<T = unknown>(
  pathname: string,
  envOverrides: Partial<Env> = {},
  init?: RequestInit,
): Promise<{ response: Response; body: T }> {
  const response = await workerFetch(pathname, envOverrides, init);
  const body = (await response.json()) as T;
  return { response, body };
}

export async function seedStaleMetricsCache(incidentId: string): Promise<void> {
  const ttlSeconds = 60;
  const cachedAt = Math.floor(Date.now() / 1000) - ttlSeconds - 30;
  const entry: CachedSlice = {
    data: metricsFixture(incidentId),
    cachedAt,
    ttlSeconds,
  };
  await env.SLICE_CACHE.put(
    cacheKey("metrics-api", incidentId),
    JSON.stringify(entry),
  );
}

export async function runRefreshQueue(
  incidentId: string,
): Promise<FetcherQueueResult> {
  const ctx = createExecutionContext();
  const batch = createMessageBatch("incident-bff-refresh", [
    {
      id: `refresh-${incidentId}`,
      timestamp: new Date(),
      attempts: 1,
      body: { origin: "metrics-api", incidentId },
    },
  ]);
  await handler.queue!(
    batch,
    { ...env, METRICS_RATE_LIMIT: "10000" },
    ctx,
  );
  return getQueueResult(batch, ctx);
}

export async function metricsCacheKey(incidentId: string): Promise<string | null> {
  return env.SLICE_CACHE.get(cacheKey("metrics-api", incidentId));
}

export async function metricsFreshInCache(incidentId: string): Promise<boolean> {
  const slice = await getFreshSlice(env, "metrics-api", incidentId);
  return slice !== null;
}

import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { metricsFixture } from "../../src/lib/fixtures";
import { cacheKey, type CachedSlice } from "../../src/lib/cache";
import { workerFetch, workerJson } from "./helpers";

async function seedStaleMetricsCache(incidentId: string): Promise<void> {
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

async function exhaustMetricsRateLimit(incidentId = "INC-RATEBURST"): Promise<void> {
  for (let i = 0; i < 12; i++) {
    await workerFetch(`/mock/metrics-api/${incidentId}`);
  }
}

/**
 * Isolated file: metrics rate limiter uses module-level state per isolate.
 */
describe("Phase 1 AC — metrics rate limit", () => {
  it("AC-4: smart route serves stale metrics; naive route still 502", async () => {
    const rateLimitEnv = { METRICS_RATE_LIMIT: "100" };
    const incidentId = "INC-4421";

    await workerJson(`/incident/${incidentId}`, rateLimitEnv);
    await seedStaleMetricsCache(incidentId);
    await exhaustMetricsRateLimit("INC-4421-BURST");

    let saw429 = false;
    for (let i = 0; i < 3; i++) {
      const response = await workerFetch(`/mock/metrics-api/${incidentId}`);
      if (response.status === 429) {
        saw429 = true;
      }
    }
    expect(saw429).toBe(true);

    const smart = await workerJson<{
      degraded: boolean;
      metrics: unknown;
    }>(`/incident/${incidentId}`);

    expect(smart.response.status).toBe(200);
    expect(smart.response.headers.get("X-Degraded")).toBe("true");
    expect(smart.body.degraded).toBe(true);
    expect(smart.body.metrics).not.toBeNull();
    expect(smart.response.headers.get("X-Stale-Slices")).toBe("metrics-api");

    const naive = await workerJson<{
      error: string;
      failedOrigin: string;
    }>(`/incident/${incidentId}/naive`);

    expect(naive.response.status).toBe(502);
    expect(naive.body.failedOrigin).toBe("metrics-api");
  });
});

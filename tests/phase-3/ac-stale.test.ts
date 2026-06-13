import { describe, expect, it } from "vitest";
import {
  exhaustMetricsRateLimit,
  resetCircuitState,
  seedStaleMetricsCache,
  workerJson,
} from "./helpers";

const rateLimitEnv = { METRICS_RATE_LIMIT: "100" };

/**
 * Isolated file: metrics rate limiter and KV stale seeding.
 */
describe("Phase 3 AC — stale-while-revalidate", () => {
  it("AC-2: stale metrics served under rate limit after TTL expiry", async () => {
    const incidentId = "INC-STALE2";
    await workerJson(`/incident/${incidentId}`, rateLimitEnv);
    await seedStaleMetricsCache(incidentId);
    await exhaustMetricsRateLimit();

    const { response, body } = await workerJson<{
      degraded: boolean;
      metrics: unknown;
      deploys: unknown;
    }>(`/incident/${incidentId}`);

    expect(response.status).toBe(200);
    expect(body.metrics).not.toBeNull();
    expect(body.degraded).toBe(true);
    expect(body.deploys).not.toBeNull();
    expect(response.headers.get("X-Degraded")).toBe("true");
    expect(response.headers.get("X-Stale-Slices")).toBe("metrics-api");
  });

  it("AC-3: open metrics circuit serves stale KV without metrics subrequest", async () => {
    await resetCircuitState();
    const incidentId = "INC-STALE3A";

    await workerJson(`/incident/${incidentId}`, rateLimitEnv);
    await seedStaleMetricsCache(incidentId);
    await exhaustMetricsRateLimit();

    for (let i = 0; i < 3; i++) {
      await workerJson(`/incident/${incidentId}`, rateLimitEnv);
    }

    const { response, body } = await workerJson<{
      metrics: unknown;
    }>(`/incident/${incidentId}`, rateLimitEnv);

    expect(response.status).toBe(200);
    expect(body.metrics).not.toBeNull();
    expect(response.headers.get("X-Circuits-Open")).toBeNull();
    expect(response.headers.get("X-Stale-Slices")).toBe("metrics-api");
    expect(response.headers.get("X-Subrequests-Used")).toBe("0");
  });

  it("AC-4: stale metrics does not block other origin slices", async () => {
    const incidentId = "INC-STALE4";
    await workerJson(`/incident/${incidentId}`, rateLimitEnv);
    await seedStaleMetricsCache(incidentId);
    await exhaustMetricsRateLimit();

    const { response, body } = await workerJson<{
      metrics: unknown;
      deploys: unknown;
      health: unknown;
      tickets: unknown;
      docs: unknown;
    }>(`/incident/${incidentId}`);

    expect(response.status).toBe(200);
    expect(body.metrics).not.toBeNull();
    for (const key of ["deploys", "health", "tickets", "docs"]) {
      expect(body[key as keyof typeof body], key).not.toBeNull();
    }
    expect(response.headers.get("X-Stale-Slices")).toBe("metrics-api");
  });
});

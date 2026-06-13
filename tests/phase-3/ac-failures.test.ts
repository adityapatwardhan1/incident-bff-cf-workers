import { describe, expect, it } from "vitest";
import { exhaustMetricsRateLimit, workerJson } from "./helpers";

/**
 * Isolated file: metrics rate limiter uses module-level state per isolate.
 */
describe("Phase 3 AC — naive regression", () => {
  it("AC-7: naive route still 502 on metrics rate limit with no stale serve", async () => {
    await exhaustMetricsRateLimit();

    const naive = await workerJson<{
      error: string;
      failedOrigin: string;
    }>("/incident/INC-NAIVE3/naive");

    expect(naive.response.status).toBe(502);
    expect(naive.body.failedOrigin).toBe("metrics-api");
  });
});

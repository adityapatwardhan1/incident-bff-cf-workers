import { describe, expect, it } from "vitest";
import { workerFetch, workerJson } from "./helpers";

/**
 * Isolated file: metrics rate limiter uses module-level state per isolate.
 */
describe("Phase 1 AC — metrics rate limit", () => {
  it("AC-4: smart route 200 degraded; naive route still 502", async () => {
    const limit = 10;
    let saw429 = false;

    for (let i = 0; i < limit + 2; i++) {
      const response = await workerFetch("/mock/metrics-api/INC-4421");
      if (response.status === 429) {
        saw429 = true;
      }
    }

    expect(saw429).toBe(true);

    const smart = await workerJson<{
      degraded: boolean;
      metrics: unknown;
    }>("/incident/INC-4421");

    expect(smart.response.status).toBe(200);
    expect(smart.response.headers.get("X-Degraded")).toBe("true");
    expect(smart.body.degraded).toBe(true);
    expect(smart.body.metrics).toBeNull();

    const naive = await workerJson<{
      error: string;
      failedOrigin: string;
    }>("/incident/INC-4421/naive");

    expect(naive.response.status).toBe(502);
    expect(naive.body.failedOrigin).toBe("metrics-api");
  });
});

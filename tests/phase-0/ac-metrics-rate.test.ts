import { describe, expect, it } from "vitest";
import { workerFetch, workerJson } from "./helpers";

/**
 * Isolated file: metrics rate limiter uses module-level state per isolate.
 * Vitest pool runs each test file in a fresh isolate.
 */
describe("Phase 0 AC — metrics rate limit", () => {
  it("AC-4: bursting metrics-api past limit yields incident 502", async () => {
    const limit = 10;
    let saw429 = false;

    for (let i = 0; i < limit + 2; i++) {
      const response = await workerFetch("/mock/metrics-api/INC-4421");
      if (response.status === 429) {
        saw429 = true;
      }
    }

    expect(saw429).toBe(true);

    const { response, body } = await workerJson<{
      error: string;
      failedOrigin: string;
    }>("/incident/INC-4421/naive");

    expect(response.status).toBe(502);
    expect(body.failedOrigin).toBe("metrics-api");
  });
});

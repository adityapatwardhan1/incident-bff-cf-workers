import { describe, expect, it } from "vitest";
import { workerJson } from "./helpers";

describe("Phase 0 AC — upstream failures", () => {
  it("AC-2: TICKETS_MODE=500 returns 502 with failedOrigin tickets-api", async () => {
    const { response, body } = await workerJson<{
      error: string;
      failedOrigin: string;
    }>("/incident/INC-4421/naive", {}, {
      headers: { "X-Tickets-Mode": "500" },
    });

    expect(response.status).toBe(502);
    expect(body.error).toBe("upstream_failure");
    expect(body.failedOrigin).toBe("tickets-api");
  });

  it("AC-3: TICKETS_MODE=timeout returns 502 with failedOrigin tickets-api", async () => {
    const { response, body } = await workerJson<{
      error: string;
      failedOrigin: string;
    }>("/incident/INC-4421/naive", {}, {
      headers: { "X-Tickets-Mode": "timeout" },
    });

    expect(response.status).toBe(502);
    expect(body.error).toBe("upstream_failure");
    expect(body.failedOrigin).toBe("tickets-api");
  }, 15_000);
});

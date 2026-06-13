import { describe, expect, it } from "vitest";
import { workerJson } from "./helpers";

describe("Phase 1 AC — upstream failures", () => {
  it("AC-2: TICKETS_MODE=500 returns 200 degraded with tickets null", async () => {
    const { response, body } = await workerJson<{
      degraded: boolean;
      tickets: unknown;
      metrics: unknown;
      deploys: unknown;
      health: unknown;
      docs: unknown;
    }>("/incident/INC-5500", {}, {
      headers: { "X-Tickets-Mode": "500" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Degraded")).toBe("true");
    expect(body.degraded).toBe(true);
    expect(body.tickets).toBeNull();
    expect(body.metrics).not.toBeNull();
    expect(body.deploys).not.toBeNull();
    expect(body.health).not.toBeNull();
    expect(body.docs).not.toBeNull();
  });

  it("AC-3: TICKETS_MODE=timeout returns 200 degraded (not 502)", async () => {
    const { response, body } = await workerJson<{
      degraded: boolean;
      tickets: unknown;
    }>("/incident/INC-5501", {}, {
      headers: { "X-Tickets-Mode": "timeout" },
    });

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.tickets).toBeNull();
  }, 15_000);

  it("AC-7: naive baseline still returns 502 on tickets failure", async () => {
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

  it("AC-8: two origin failures returns 200 with two null slices", async () => {
    const limit = 10;
    for (let i = 0; i < limit + 2; i++) {
      await workerJson("/mock/metrics-api/INC-5508");
    }

    const { response, body } = await workerJson<{
      degraded: boolean;
      metrics: unknown;
      tickets: unknown;
      deploys: unknown;
    }>("/incident/INC-5508", {}, {
      headers: { "X-Tickets-Mode": "500" },
    });

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(true);
    expect(body.metrics).toBeNull();
    expect(body.tickets).toBeNull();
    expect(body.deploys).not.toBeNull();
  });
});

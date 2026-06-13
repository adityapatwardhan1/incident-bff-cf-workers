import { describe, expect, it } from "vitest";
import { resetCircuitState, workerFetch, workerJson } from "./helpers";

const FAIL_HEADERS = { headers: { "X-Tickets-Mode": "500" } };

/**
 * Isolated file: D1 circuit state and mock call counters use module-level state.
 */
describe("Phase 2 AC — circuit breaker", () => {
  async function tripTicketsCircuit(incidentPrefix: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await workerJson(`/incident/${incidentPrefix}${i}`, {}, FAIL_HEADERS);
    }
  }

  it("AC-2: 4th request skips tickets fetch when circuit is open", async () => {
    await resetCircuitState();
    await tripTicketsCircuit("INC-TRIP");

    const baseline = await workerFetch("/mock/tickets-api/INC-CHK", {}, FAIL_HEADERS);
    const baseCount = Number(baseline.headers.get("X-Mock-Call-Count"));

    const { response, body } = await workerJson<{
      tickets: unknown;
    }>("/incident/INC-TRIP9", {}, FAIL_HEADERS);

    const afterSmart = await workerFetch("/mock/tickets-api/INC-CHK", {}, FAIL_HEADERS);
    const afterCount = Number(afterSmart.headers.get("X-Mock-Call-Count"));

    expect(response.status).toBe(200);
    expect(body.tickets).toBeNull();
    expect(response.headers.get("X-Circuits-Open")).toBe("tickets-api");
    expect(afterCount).toBe(baseCount + 1);
  });

  it("AC-3: open circuit excludes tickets from subrequest count", async () => {
    await resetCircuitState();
    await tripTicketsCircuit("INC-SUB");

    const { response } = await workerJson("/incident/INC-SUB9", {}, FAIL_HEADERS);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Subrequests-Used")).toBe("4");
    expect(response.headers.get("X-Circuits-Open")).toBe("tickets-api");
  });

  it("AC-4: fresh KV served when circuit is open", async () => {
    await resetCircuitState();
    const incidentId = "INC-KVOPEN";

    await workerJson(`/incident/${incidentId}`);

    await tripTicketsCircuit("INC-OTHER");

    const { response, body } = await workerJson<{
      tickets: unknown;
      degraded: boolean;
    }>(`/incident/${incidentId}`, {}, FAIL_HEADERS);

    expect(response.status).toBe(200);
    expect(body.tickets).not.toBeNull();
    expect(response.headers.get("X-Circuits-Open")).toBeNull();
  });

  it("AC-5: half-open probe recovers then re-trips on failures", async () => {
    await resetCircuitState();
    const envOverrides = {
      CIRCUIT_OPEN_SECONDS: "1",
      METRICS_RATE_LIMIT: "100",
    };

    for (let i = 0; i < 3; i++) {
      await workerJson(`/incident/INC-HALF${i}`, envOverrides, FAIL_HEADERS);
    }

    await new Promise((r) => setTimeout(r, 1_100));

    const probe = await workerJson<{ tickets: unknown }>(
      "/incident/INC-HALFPROBE",
      envOverrides,
    );
    expect(probe.response.status).toBe(200);
    expect(probe.body.tickets).not.toBeNull();
    expect(probe.response.headers.get("X-Circuits-Open")).toBeNull();

    for (let i = 0; i < 3; i++) {
      await workerJson(`/incident/INC-RETRIP${i}`, envOverrides, FAIL_HEADERS);
    }

    const skipped = await workerJson("/incident/INC-RETRIP9", envOverrides, FAIL_HEADERS);
    const openCircuits = skipped.response.headers.get("X-Circuits-Open")?.split(",") ?? [];
    expect(openCircuits).toContain("tickets-api");
  });
});

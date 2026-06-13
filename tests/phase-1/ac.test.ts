import { describe, expect, it } from "vitest";
import { workerJson } from "./helpers";

describe("Phase 1 AC — core routes", () => {
  it("AC-1: happy path returns 200 with all slices, degraded false, 5 subrequests", async () => {
    const { response, body } = await workerJson<{
      incidentId: string;
      degraded: boolean;
      metrics: unknown;
      deploys: unknown;
      health: unknown;
      tickets: unknown;
      docs: unknown;
    }>("/incident/INC-4421");

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Subrequests-Used")).toBe("5");
    expect(response.headers.get("X-Degraded")).toBeNull();
    expect(body.incidentId).toBe("INC-4421");
    expect(body.degraded).toBe(false);
    for (const key of ["metrics", "deploys", "health", "tickets", "docs"]) {
      expect(body[key as keyof typeof body], key).not.toBeNull();
    }
  });

  it("AC-6: invalid incidentId returns 400", async () => {
    const { response, body } = await workerJson<{ error: string }>("/incident/BAD");

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_incident_id");
  });
});

import { describe, expect, it } from "vitest";
import { workerJson } from "./helpers";

describe("Phase 3 AC — core routes", () => {
  it("AC-1: happy path returns 200 with all slices, degraded false, no stale header", async () => {
    const { response, body } = await workerJson<{
      incidentId: string;
      degraded: boolean;
      metrics: unknown;
      deploys: unknown;
      health: unknown;
      tickets: unknown;
      docs: unknown;
    }>("/incident/INC-8301");

    expect(response.status).toBe(200);
    expect(body.degraded).toBe(false);
    for (const key of ["metrics", "deploys", "health", "tickets", "docs"]) {
      expect(body[key as keyof typeof body], key).not.toBeNull();
    }
    expect(response.headers.get("X-Stale-Slices")).toBeNull();
  });
});

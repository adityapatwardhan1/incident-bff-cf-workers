import { describe, expect, it } from "vitest";
import { ORIGIN_IDS } from "../../src/lib/origins";
import { workerFetch, workerJson } from "./helpers";

describe("Phase 0 AC — core routes", () => {
  it("AC-1: happy path returns 200 with all five slice keys", async () => {
    const { response, body } = await workerJson<Record<string, unknown>>(
      "/incident/INC-4421/naive",
    );

    expect(response.status).toBe(200);
    expect(body.incidentId).toBe("INC-4421");
    for (const key of ["metrics", "deploys", "health", "tickets", "docs"]) {
      expect(body).toHaveProperty(key);
    }
  });

  it("AC-5: each mock route returns 200 in isolation", async () => {
    for (const origin of ORIGIN_IDS) {
      const response = await workerFetch(
        `/mock/${origin}/INC-4421`,
      );
      expect(response.status, origin).toBe(200);
    }
  });

  it("AC-6: invalid incidentId returns 400", async () => {
    const { response, body } = await workerJson<{ error: string }>(
      "/incident/BAD/naive",
    );

    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_incident_id");
  });

  it("AC-7: bare /incident/:id without /naive returns 404", async () => {
    const response = await workerFetch("/incident/INC-4421");
    expect(response.status).toBe(404);
  });

  it("health route returns ok", async () => {
    const { response, body } = await workerJson<{ ok: boolean }>("/health");
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});

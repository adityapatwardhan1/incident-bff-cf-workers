import { describe, expect, it } from "vitest";
import { workerJson } from "./helpers";

describe("Phase 2 AC — naive regression", () => {
  it("AC-6: naive route still returns 502 on tickets failure", async () => {
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
});

import { describe, expect, it } from "vitest";
import { workerFetch } from "./helpers";

describe("Phase 1 AC — KV slice cache", () => {
  it("AC-5: warm cache second request uses 0 subrequests", async () => {
    const path = "/incident/INC-7701";

    const first = await workerFetch(path);
    expect(first.status).toBe(200);
    expect(first.headers.get("X-Subrequests-Used")).toBe("5");

    const second = await workerFetch(path);
    expect(second.status).toBe(200);
    expect(second.headers.get("X-Subrequests-Used")).toBe("0");
    expect(second.headers.get("X-Degraded")).toBeNull();

    const body = (await second.json()) as { degraded: boolean };
    expect(body.degraded).toBe(false);
  });
});

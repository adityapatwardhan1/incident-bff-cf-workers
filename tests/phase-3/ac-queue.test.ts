import { describe, expect, it } from "vitest";
import {
  metricsCacheKey,
  metricsFreshInCache,
  runRefreshQueue,
  workerJson,
} from "./helpers";

describe("Phase 3 AC — refresh queue", () => {
  it("AC-5: queue consumer writes fresh metrics slice to KV", async () => {
    const incidentId = "INC-QREF";
    await runRefreshQueue(incidentId);

    expect(await metricsFreshInCache(incidentId)).toBe(true);
    expect(await metricsCacheKey(incidentId)).not.toBeNull();
  });
  it("AC-6: metrics cache miss enqueues background refresh", async () => {
    const incidentId = "INC-QENQ";
    const { response } = await workerJson(`/incident/${incidentId}`, {
      METRICS_RATE_LIMIT: "100",
    });

    expect(response.status).toBe(200);
    expect(await metricsFreshInCache(incidentId)).toBe(true);
  });
});

import { metricsFixture, mockJsonResponse } from "../../lib/fixtures";

const WINDOW_MS = 60_000;
const requestTimestamps: number[] = [];

function parseLimit(env: Env): number {
  const n = parseInt(env.METRICS_RATE_LIMIT ?? "10", 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

function isRateLimited(limit: number): boolean {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < windowStart) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= limit) {
    return true;
  }
  requestTimestamps.push(now);
  return false;
}

export async function handleMetrics(
  _request: Request,
  env: Env,
  incidentId: string,
): Promise<Response> {
  const limit = parseLimit(env);
  if (isRateLimited(limit)) {
    return mockJsonResponse(
      "metrics-api",
      { error: "rate_limited", incidentId },
      { status: 429 },
    );
  }
  return mockJsonResponse("metrics-api", metricsFixture(incidentId));
}

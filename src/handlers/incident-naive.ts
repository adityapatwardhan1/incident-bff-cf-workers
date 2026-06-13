import {
  isValidIncidentId,
  ORIGIN_IDS,
  type IncidentErrorResponse,
  type IncidentResponse,
  type OriginId,
} from "../lib/origins";
import { fetchOriginJson } from "../lib/upstream-fetch";

interface FetchSliceResult {
  origin: OriginId;
  ok: boolean;
  data?: unknown;
}

async function fetchSlice(
  env: Env,
  incomingRequest: Request,
  origin: OriginId,
  incidentId: string,
): Promise<FetchSliceResult> {
  const result = await fetchOriginJson(env, incomingRequest, origin, incidentId);
  if (!result.ok) {
    return { origin, ok: false };
  }
  return { origin, ok: true, data: result.data };
}

export async function handleIncidentNaive(
  request: Request,
  env: Env,
  incidentId: string,
): Promise<Response> {
  if (!isValidIncidentId(incidentId)) {
    return Response.json(
      { error: "invalid_incident_id", incidentId },
      { status: 400 },
    );
  }

  const results = await Promise.all(
    ORIGIN_IDS.map((origin) =>
      fetchSlice(env, request, origin, incidentId),
    ),
  );

  for (const origin of ORIGIN_IDS) {
    const result = results.find((r) => r.origin === origin);
    if (!result?.ok) {
      const body: IncidentErrorResponse = {
        error: "upstream_failure",
        incidentId,
        failedOrigin: origin,
      };
      return Response.json(body, { status: 502 });
    }
  }

  const body: IncidentResponse = {
    incidentId,
    metrics: results.find((r) => r.origin === "metrics-api")!
      .data as IncidentResponse["metrics"],
    deploys: results.find((r) => r.origin === "deploys-api")!
      .data as IncidentResponse["deploys"],
    health: results.find((r) => r.origin === "health-api")!
      .data as IncidentResponse["health"],
    tickets: results.find((r) => r.origin === "tickets-api")!
      .data as IncidentResponse["tickets"],
    docs: results.find((r) => r.origin === "docs-api")!
      .data as IncidentResponse["docs"],
  };

  return Response.json(body);
}

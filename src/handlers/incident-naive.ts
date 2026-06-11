import {
  buildMockUrl,
  isValidIncidentId,
  ORIGIN_IDS,
  UPSTREAM_FETCH_TIMEOUT_MS,
  type IncidentErrorResponse,
  type IncidentResponse,
  type OriginId,
} from "../lib/origins";

interface FetchSliceResult {
  origin: OriginId;
  ok: boolean;
  data?: unknown;
}

async function fetchWithTimeout(
  doFetch: (request: Request) => Promise<Response>,
  url: string,
  timeoutMs: number,
  forwardHeaders?: Headers,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = new Headers(forwardHeaders);
    return await doFetch(new Request(url, { signal: controller.signal, headers }));
  } finally {
    clearTimeout(timer);
  }
}

function originFetcher(env: Env): (request: Request) => Promise<Response> {
  if (env.SELF) {
    return (request) => env.SELF!.fetch(request);
  }
  return (request) => fetch(request);
}

async function fetchSlice(
  env: Env,
  incomingRequest: Request,
  origin: OriginId,
  incidentId: string,
): Promise<FetchSliceResult> {
  const url = buildMockUrl(env, incomingRequest.url, origin, incidentId);
  try {
    const response = await fetchWithTimeout(
      originFetcher(env),
      url,
      UPSTREAM_FETCH_TIMEOUT_MS,
      incomingRequest.headers,
    );
    if (!response.ok) {
      return { origin, ok: false };
    }
    const data = await response.json();
    return { origin, ok: true, data };
  } catch {
    return { origin, ok: false };
  }
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

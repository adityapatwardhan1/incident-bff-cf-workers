import { getFreshSlice, putSlice, ttlForOrigin } from "../lib/cache";
import { mergeSlices, hasAnySlice } from "../lib/merge";
import {
  isValidIncidentId,
  ORIGIN_IDS,
  type NoDataErrorResponse,
  type OriginId,
} from "../lib/origins";
import { createSubrequestCounter } from "../lib/subrequests";
import { fetchOriginJson } from "../lib/upstream-fetch";
import type { SubrequestCounter } from "../lib/subrequests";

async function resolveSlice(
  env: Env,
  request: Request,
  origin: OriginId,
  incidentId: string,
  counter: SubrequestCounter,
): Promise<unknown | null> {
  const cached = await getFreshSlice(env, origin, incidentId);
  if (cached !== null) {
    return cached;
  }

  counter.increment();
  const result = await fetchOriginJson(env, request, origin, incidentId);
  if (!result.ok) {
    return null;
  }

  const ttl = ttlForOrigin(env, origin);
  await putSlice(env, origin, incidentId, result.data, ttl);
  return result.data;
}

function smartResponseHeaders(
  counter: SubrequestCounter,
  degraded: boolean,
): Headers {
  const headers = new Headers({
    "X-Subrequests-Used": String(counter.value()),
  });
  if (degraded) {
    headers.set("X-Degraded", "true");
  }
  return headers;
}

export async function handleIncident(
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

  const counter = createSubrequestCounter();

  const settled = await Promise.allSettled(
    ORIGIN_IDS.map(async (origin) => ({
      origin,
      slice: await resolveSlice(env, request, origin, incidentId, counter),
    })),
  );

  const results = settled.map((outcome, i) => {
    const origin = ORIGIN_IDS[i]!;
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    return { origin, slice: null };
  });

  const merged = mergeSlices(incidentId, results);
  const headers = smartResponseHeaders(counter, merged.degraded);

  if (!hasAnySlice(merged)) {
    const body: NoDataErrorResponse = {
      error: "no_data",
      incidentId,
      degraded: true,
    };
    return Response.json(body, { status: 503, headers });
  }

  return Response.json(merged, { headers });
}

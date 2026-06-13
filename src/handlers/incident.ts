import { getFreshSlice, putSlice, ttlForOrigin } from "../lib/cache";
import { recordFailure, recordSuccess, shouldSkipFetch } from "../lib/circuit";
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

interface ResolveSliceResult {
  slice: unknown | null;
  circuitSkipped: boolean;
}

async function resolveSlice(
  env: Env,
  request: Request,
  origin: OriginId,
  incidentId: string,
  counter: SubrequestCounter,
): Promise<ResolveSliceResult> {
  const cached = await getFreshSlice(env, origin, incidentId);
  if (cached !== null) {
    return { slice: cached, circuitSkipped: false };
  }

  if (await shouldSkipFetch(env, origin)) {
    return { slice: null, circuitSkipped: true };
  }

  counter.increment();
  const result = await fetchOriginJson(env, request, origin, incidentId);
  if (!result.ok) {
    await recordFailure(env, origin);
    return { slice: null, circuitSkipped: false };
  }

  const ttl = ttlForOrigin(env, origin);
  await putSlice(env, origin, incidentId, result.data, ttl);
  await recordSuccess(env, origin);
  return { slice: result.data, circuitSkipped: false };
}

function smartResponseHeaders(
  counter: SubrequestCounter,
  degraded: boolean,
  circuitsOpen: OriginId[],
): Headers {
  const headers = new Headers({
    "X-Subrequests-Used": String(counter.value()),
  });
  if (degraded) {
    headers.set("X-Degraded", "true");
  }
  if (circuitsOpen.length > 0) {
    headers.set("X-Circuits-Open", circuitsOpen.join(","));
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
  const circuitsOpen: OriginId[] = [];

  const settled = await Promise.allSettled(
    ORIGIN_IDS.map(async (origin) => {
      const resolved = await resolveSlice(
        env,
        request,
        origin,
        incidentId,
        counter,
      );
      if (resolved.circuitSkipped) {
        circuitsOpen.push(origin);
      }
      return { origin, slice: resolved.slice };
    }),
  );

  const results = settled.map((outcome, i) => {
    const origin = ORIGIN_IDS[i]!;
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    return { origin, slice: null };
  });

  const merged = mergeSlices(incidentId, results);
  const headers = smartResponseHeaders(counter, merged.degraded, circuitsOpen);

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

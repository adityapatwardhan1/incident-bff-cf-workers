import { getFreshSlice, getStaleSlice, putSlice, ttlForOrigin } from "../lib/cache";
import { recordFailure, recordSuccess, shouldSkipFetch } from "../lib/circuit";
import { mergeSlices, hasAnySlice } from "../lib/merge";
import {
  isValidIncidentId,
  ORIGIN_IDS,
  type NoDataErrorResponse,
  type OriginId,
} from "../lib/origins";
import { enqueueMetricsRefresh } from "../lib/refresh-queue";
import { createSubrequestCounter } from "../lib/subrequests";
import { fetchOriginJson, fetchOriginWithStatus } from "../lib/upstream-fetch";
import type { SubrequestCounter } from "../lib/subrequests";

interface ResolveSliceResult {
  slice: unknown | null;
  circuitSkipped: boolean;
  stale: boolean;
}

async function resolveMetricsSlice(
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  incidentId: string,
  counter: SubrequestCounter,
): Promise<ResolveSliceResult> {
  const origin: OriginId = "metrics-api";

  const freshSlice = await getFreshSlice(env, origin, incidentId);
  if (freshSlice !== null) {
    return { slice: freshSlice, circuitSkipped: false, stale: false };
  }

  if (await shouldSkipFetch(env, origin)) {
    const staleSlice = await getStaleSlice(env, origin, incidentId);
    if (staleSlice !== null) {
      return { slice: staleSlice, circuitSkipped: false, stale: true };
    }
    return { slice: null, circuitSkipped: true, stale: false };
  }

  enqueueMetricsRefresh(ctx, env, incidentId);

  counter.increment();
  const result = await fetchOriginWithStatus(env, request, origin, incidentId);
  if (result.ok) {
    const ttl = ttlForOrigin(env, origin);
    await putSlice(env, origin, incidentId, result.data, ttl);
    await recordSuccess(env, origin);
    return { slice: result.data, circuitSkipped: false, stale: false };
  }

  await recordFailure(env, origin);

  if (result.status === 429) {
    enqueueMetricsRefresh(ctx, env, incidentId);
    const freshSliceAfter429 = await getFreshSlice(env, origin, incidentId);
    if (freshSliceAfter429 !== null) {
      return { slice: freshSliceAfter429, circuitSkipped: false, stale: false };
    }
    const staleSlice = await getStaleSlice(env, origin, incidentId);
    if (staleSlice !== null) {
      return { slice: staleSlice, circuitSkipped: false, stale: true };
    }
  }

  return { slice: null, circuitSkipped: false, stale: false };
}

async function resolveSlice(
  env: Env,
  ctx: ExecutionContext,
  request: Request,
  origin: OriginId,
  incidentId: string,
  counter: SubrequestCounter,
): Promise<ResolveSliceResult> {
  if (origin === "metrics-api") {
    return resolveMetricsSlice(env, ctx, request, incidentId, counter);
  }

  const freshSlice = await getFreshSlice(env, origin, incidentId);
  if (freshSlice !== null) {
    return { slice: freshSlice, circuitSkipped: false, stale: false };
  }

  if (await shouldSkipFetch(env, origin)) {
    return { slice: null, circuitSkipped: true, stale: false };
  }

  counter.increment();
  const result = await fetchOriginJson(env, request, origin, incidentId);
  if (!result.ok) {
    await recordFailure(env, origin);
    return { slice: null, circuitSkipped: false, stale: false };
  }

  const ttl = ttlForOrigin(env, origin);
  await putSlice(env, origin, incidentId, result.data, ttl);
  await recordSuccess(env, origin);
  return { slice: result.data, circuitSkipped: false, stale: false };
}

function smartResponseHeaders(
  counter: SubrequestCounter,
  degraded: boolean,
  circuitsOpen: OriginId[],
  staleSlices: OriginId[],
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
  if (staleSlices.length > 0) {
    headers.set("X-Stale-Slices", staleSlices.join(","));
  }
  return headers;
}

export async function handleIncident(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
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
  const staleSlices: OriginId[] = [];

  const settled = await Promise.allSettled(
    ORIGIN_IDS.map(async (origin) => {
      const resolved = await resolveSlice(
        env,
        ctx,
        request,
        origin,
        incidentId,
        counter,
      );
      if (resolved.circuitSkipped) {
        circuitsOpen.push(origin);
      }
      if (resolved.stale) {
        staleSlices.push(origin);
      }
      return {
        origin,
        slice: resolved.slice,
        stale: resolved.stale,
      };
    }),
  );

  const results = settled.map((outcome, i) => {
    const origin = ORIGIN_IDS[i]!;
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    return { origin, slice: null, stale: false };
  });

  const merged = mergeSlices(incidentId, results);
  const headers = smartResponseHeaders(
    counter,
    merged.degraded,
    circuitsOpen,
    staleSlices,
  );

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

import {
  ORIGIN_IDS,
  SLICE_KEYS,
  type OriginId,
  type PartialIncidentResponse,
} from "./origins";

export interface OriginSliceResult {
  origin: OriginId;
  slice: unknown | null;
  stale?: boolean;
}

export function mergeSlices(
  incidentId: string,
  results: OriginSliceResult[],
): PartialIncidentResponse {
  const byOrigin = new Map(results.map((r) => [r.origin, r.slice]));
  const slices = ORIGIN_IDS.map((origin) => byOrigin.get(origin) ?? null);
  const degraded =
    slices.some((slice) => slice === null) ||
    results.some((r) => r.stale === true);

  return {
    incidentId,
    degraded,
    metrics: (byOrigin.get("metrics-api") ?? null) as PartialIncidentResponse["metrics"],
    deploys: (byOrigin.get("deploys-api") ?? null) as PartialIncidentResponse["deploys"],
    health: (byOrigin.get("health-api") ?? null) as PartialIncidentResponse["health"],
    tickets: (byOrigin.get("tickets-api") ?? null) as PartialIncidentResponse["tickets"],
    docs: (byOrigin.get("docs-api") ?? null) as PartialIncidentResponse["docs"],
  };
}

export function hasAnySlice(response: PartialIncidentResponse): boolean {
  return ORIGIN_IDS.some((origin) => response[SLICE_KEYS[origin]] !== null);
}

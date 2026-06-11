export const ORIGIN_IDS = [
  "metrics-api",
  "deploys-api",
  "health-api",
  "tickets-api",
  "docs-api",
] as const;

export type OriginId = (typeof ORIGIN_IDS)[number];

export const SLICE_KEYS: Record<OriginId, keyof IncidentResponse> = {
  "metrics-api": "metrics",
  "deploys-api": "deploys",
  "health-api": "health",
  "tickets-api": "tickets",
  "docs-api": "docs",
};

export interface MetricsSlice {
  errorRate: number;
  window: string;
  incidentId?: string;
}

export interface DeploysSlice {
  recent: Array<{ id: string; service: string; at: string }>;
  incidentId?: string;
}

export interface HealthSlice {
  regions: Array<{ id: string; status: string }>;
  incidentId?: string;
}

export interface TicketsSlice {
  open: Array<{ id: string; title: string }>;
  incidentId?: string;
}

export interface DocsSlice {
  runbookUrl: string;
  incidentId?: string;
}

export interface IncidentResponse {
  incidentId: string;
  metrics: MetricsSlice;
  deploys: DeploysSlice;
  health: HealthSlice;
  tickets: TicketsSlice;
  docs: DocsSlice;
}

export interface IncidentErrorResponse {
  error: "upstream_failure";
  incidentId: string;
  failedOrigin: OriginId;
}

/** INC-4421 style: prefix INC- plus alphanumeric segment */
export const INCIDENT_ID_PATTERN = /^INC-[A-Za-z0-9]+$/;

export function isValidIncidentId(id: string): boolean {
  return INCIDENT_ID_PATTERN.test(id);
}

export function mockPath(origin: OriginId, incidentId: string): string {
  return `/mock/${origin}/${incidentId}`;
}

export function buildMockUrl(
  env: Env,
  requestUrl: string,
  origin: OriginId,
  incidentId: string,
): string {
  const base = env.MOCK_BASE_URL?.replace(/\/$/, "") ?? new URL(requestUrl).origin;
  return `${base}${mockPath(origin, incidentId)}`;
}

export const UPSTREAM_FETCH_TIMEOUT_MS = 5_000;

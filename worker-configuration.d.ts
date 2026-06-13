interface RefreshMessage {
  origin: "metrics-api";
  incidentId: string;
}

interface Env {
  SELF?: Fetcher;
  SLICE_CACHE: KVNamespace;
  DB: D1Database;
  REFRESH_QUEUE: Queue<RefreshMessage>;
  TICKETS_MODE?: string;
  METRICS_RATE_LIMIT?: string;
  MOCK_BASE_URL?: string;
  SLICE_TTL_SECONDS?: string;
  DOCS_SLICE_TTL_SECONDS?: string;
  STALE_MAX_SECONDS?: string;
  METRICS_STALE_MAX_SECONDS?: string;
  CIRCUIT_FAILURE_THRESHOLD?: string;
  CIRCUIT_OPEN_SECONDS?: string;
}

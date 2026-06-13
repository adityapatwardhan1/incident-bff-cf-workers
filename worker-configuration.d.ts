interface Env {
  SELF?: Fetcher;
  SLICE_CACHE: KVNamespace;
  TICKETS_MODE?: string;
  METRICS_RATE_LIMIT?: string;
  MOCK_BASE_URL?: string;
  SLICE_TTL_SECONDS?: string;
  DOCS_SLICE_TTL_SECONDS?: string;
}

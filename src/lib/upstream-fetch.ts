import { buildMockUrl, UPSTREAM_FETCH_TIMEOUT_MS, type OriginId } from "./origins";

export function originFetcher(env: Env): (request: Request) => Promise<Response> {
  if (env.SELF) {
    return (request) => env.SELF!.fetch(request);
  }
  return (request) => fetch(request);
}

export async function fetchWithTimeout(
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

export async function fetchOriginJson(
  env: Env,
  incomingRequest: Request,
  origin: OriginId,
  incidentId: string,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const url = buildMockUrl(env, incomingRequest.url, origin, incidentId);
  try {
    const response = await fetchWithTimeout(
      originFetcher(env),
      url,
      UPSTREAM_FETCH_TIMEOUT_MS,
      incomingRequest.headers,
    );
    if (!response.ok) {
      return { ok: false };
    }
    const data = await response.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

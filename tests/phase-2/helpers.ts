import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import type { ExportedHandler } from "@cloudflare/workers-types";
import worker from "../../src/index";

const BASE = "http://example.com";
const handler = worker as ExportedHandler<Env>;

export async function resetCircuitState(): Promise<void> {
  await env.DB.prepare("DELETE FROM circuit_state").run();
}

export async function workerFetch(
  pathname: string,
  envOverrides: Partial<Env> = {},
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(`${BASE}${pathname}`, init);
  const ctx = createExecutionContext();
  const response = await handler.fetch!(request, { ...env, ...envOverrides }, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

export async function workerJson<T = unknown>(
  pathname: string,
  envOverrides: Partial<Env> = {},
  init?: RequestInit,
): Promise<{ response: Response; body: T }> {
  const response = await workerFetch(pathname, envOverrides, init);
  const body = (await response.json()) as T;
  return { response, body };
}

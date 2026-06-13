import { handleIncident } from "./handlers/incident";
import { handleIncidentNaive } from "./handlers/incident-naive";
import { handleDeploys } from "./handlers/mock/deploys";
import { handleDocs } from "./handlers/mock/docs";
import { handleHealth } from "./handlers/mock/health";
import { handleMetrics } from "./handlers/mock/metrics";
import { handleTickets } from "./handlers/mock/tickets";
import type { RefreshMessage } from "./lib/refresh-queue";
import { ORIGIN_IDS, type OriginId } from "./lib/origins";
import { handleRefreshQueue } from "./queue/refresh";

type UpstreamHandler = (
  request: Request,
  env: Env,
  incidentId: string,
) => Promise<Response>;

const UPSTREAM_HANDLERS: Record<OriginId, UpstreamHandler> = {
  "metrics-api": handleMetrics,
  "deploys-api": handleDeploys,
  "health-api": handleHealth,
  "tickets-api": handleTickets,
  "docs-api": handleDocs,
};

function notFound(): Response {
  return Response.json({ error: "not_found" }, { status: 404 });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "GET" && pathname === "/health") {
      return Response.json({ ok: true });
    }

    const naiveMatch = pathname.match(/^\/incident\/([^/]+)\/naive$/);
    if (request.method === "GET" && naiveMatch) {
      return handleIncidentNaive(request, env, naiveMatch[1]!);
    }

    const incidentMatch = pathname.match(/^\/incident\/([^/]+)$/);
    if (request.method === "GET" && incidentMatch) {
      return handleIncident(request, env, ctx, incidentMatch[1]!);
    }

    const mockMatch = pathname.match(/^\/mock\/([^/]+)\/([^/]+)$/);
    if (request.method === "GET" && mockMatch) {
      const origin = mockMatch[1] as OriginId;
      const incidentId = mockMatch[2]!;
      if (!ORIGIN_IDS.includes(origin)) {
        return notFound();
      }
      return UPSTREAM_HANDLERS[origin](request, env, incidentId);
    }

    return notFound();
  },

  async queue(
    batch: MessageBatch<RefreshMessage>,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    await handleRefreshQueue(batch, env);
  },
} satisfies ExportedHandler<Env, RefreshMessage>;

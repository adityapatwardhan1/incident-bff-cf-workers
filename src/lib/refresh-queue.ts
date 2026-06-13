export interface RefreshMessage {
  origin: "metrics-api";
  incidentId: string;
}

export function enqueueMetricsRefresh(
  ctx: ExecutionContext,
  env: Env,
  incidentId: string,
): void {
  ctx.waitUntil(
    env.REFRESH_QUEUE.send({ origin: "metrics-api", incidentId }),
  );
}

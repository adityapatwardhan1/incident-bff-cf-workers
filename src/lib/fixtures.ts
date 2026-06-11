import type {
  DeploysSlice,
  DocsSlice,
  HealthSlice,
  MetricsSlice,
  TicketsSlice,
} from "./origins";

export function metricsFixture(incidentId: string): MetricsSlice {
  return { errorRate: 0.042, window: "5m", incidentId };
}

export function deploysFixture(incidentId: string): DeploysSlice {
  return {
    incidentId,
    recent: [
      {
        id: "d-1",
        service: "api",
        at: "2026-06-08T12:00:00Z",
      },
    ],
  };
}

export function healthFixture(incidentId: string): HealthSlice {
  return {
    incidentId,
    regions: [{ id: "us-east", status: "degraded" }],
  };
}

export function ticketsFixture(incidentId: string): TicketsSlice {
  return {
    incidentId,
    open: [{ id: "T-99", title: "Elevated errors" }],
  };
}

export function docsFixture(incidentId: string): DocsSlice {
  return {
    incidentId,
    runbookUrl: "https://example.com/runbooks/incident",
  };
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

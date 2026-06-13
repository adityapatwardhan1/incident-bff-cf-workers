import { delay, mockJsonResponse, ticketsFixture } from "../../lib/fixtures";
import { UPSTREAM_FETCH_TIMEOUT_MS } from "../../lib/origins";

function ticketsMode(request: Request, env: Env): string {
  return (
    request.headers.get("X-Tickets-Mode") ??
    env.TICKETS_MODE ??
    "ok"
  ).toLowerCase();
}

export async function handleTickets(
  request: Request,
  env: Env,
  incidentId: string,
): Promise<Response> {
  const mode = ticketsMode(request, env);

  if (mode === "500") {
    return mockJsonResponse(
      "tickets-api",
      { error: "internal_error", incidentId },
      { status: 500 },
    );
  }

  if (mode === "timeout") {
    await delay(UPSTREAM_FETCH_TIMEOUT_MS + 1_000);
    return mockJsonResponse("tickets-api", ticketsFixture(incidentId));
  }

  await delay(300);
  return mockJsonResponse("tickets-api", ticketsFixture(incidentId));
}

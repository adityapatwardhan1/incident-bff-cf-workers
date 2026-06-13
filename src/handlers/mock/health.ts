import { healthFixture, mockJsonResponse } from "../../lib/fixtures";

export async function handleHealth(
  _request: Request,
  _env: Env,
  incidentId: string,
): Promise<Response> {
  return mockJsonResponse("health-api", healthFixture(incidentId));
}

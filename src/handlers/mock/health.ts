import { healthFixture, jsonResponse } from "../../lib/fixtures";

export async function handleHealth(
  _request: Request,
  _env: Env,
  incidentId: string,
): Promise<Response> {
  return jsonResponse(healthFixture(incidentId));
}

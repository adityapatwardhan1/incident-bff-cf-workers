import { delay, deploysFixture, mockJsonResponse } from "../../lib/fixtures";

export async function handleDeploys(
  _request: Request,
  _env: Env,
  incidentId: string,
): Promise<Response> {
  await delay(50);
  return mockJsonResponse("deploys-api", deploysFixture(incidentId));
}

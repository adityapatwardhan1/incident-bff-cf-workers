import { docsFixture, mockJsonResponse } from "../../lib/fixtures";

export async function handleDocs(
  _request: Request,
  _env: Env,
  incidentId: string,
): Promise<Response> {
  return mockJsonResponse("docs-api", docsFixture(incidentId));
}

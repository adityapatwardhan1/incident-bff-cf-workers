import { docsFixture, jsonResponse } from "../../lib/fixtures";

export async function handleDocs(
  _request: Request,
  _env: Env,
  incidentId: string,
): Promise<Response> {
  return jsonResponse(docsFixture(incidentId));
}

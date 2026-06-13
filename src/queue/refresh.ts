import { putSlice, ttlForOrigin } from "../lib/cache";
import { buildMockUrl, UPSTREAM_FETCH_TIMEOUT_MS } from "../lib/origins";
import type { RefreshMessage } from "../lib/refresh-queue";
import { fetchWithTimeout, originFetcher } from "../lib/upstream-fetch";

export async function handleRefreshQueue(
  batch: MessageBatch<RefreshMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const { incidentId } = message.body;
    const url = buildMockUrl(env, "http://example.com/", "metrics-api", incidentId);

    try {
      const response = await fetchWithTimeout(
        originFetcher(env),
        url,
        UPSTREAM_FETCH_TIMEOUT_MS,
      );
      if (!response.ok) {
        message.retry({ delaySeconds: 5 });
        continue;
      }

      const data = await response.json();
      await putSlice(
        env,
        "metrics-api",
        incidentId,
        data,
        ttlForOrigin(env, "metrics-api"),
      );
      message.ack();
    } catch {
      message.retry({ delaySeconds: 5 });
    }
  }
}

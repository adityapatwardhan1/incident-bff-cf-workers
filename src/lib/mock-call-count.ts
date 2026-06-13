import type { OriginId } from "./origins";

const callCounts: Partial<Record<OriginId, number>> = {};

export function recordMockCall(origin: OriginId): number {
  const next = (callCounts[origin] ?? 0) + 1;
  callCounts[origin] = next;
  return next;
}

export function getMockCallCount(origin: OriginId): number {
  return callCounts[origin] ?? 0;
}

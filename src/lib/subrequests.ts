/** Counts origin fetches only — KV get/put do not increment. */
export function createSubrequestCounter() {
  let count = 0;
  return {
    increment(): void {
      count += 1;
    },
    value(): number {
      return count;
    },
  };
}

export type SubrequestCounter = ReturnType<typeof createSubrequestCounter>;

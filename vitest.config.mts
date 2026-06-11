import path from "node:path";
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    testTimeout: 15_000,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    poolOptions: {
      workers: {
        wrangler: {
          configPath: path.join(import.meta.dirname, "wrangler.toml"),
        },
      },
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/db/**/*.test.ts", "lib/**/*.test.ts"],
    // Slot generation must not depend on the machine's time zone.
    env: { TZ: "UTC" },
    // Database tests boot an in-memory Postgres (PGlite) per file.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/supabase/**", "lib/env/**", "**/*.test.ts"],
    },
  },
});

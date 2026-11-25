import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "lib/**/*.test.ts"],
    // Slot generation must not depend on the machine's time zone.
    env: { TZ: "UTC" },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/supabase/**", "lib/env/**", "**/*.test.ts"],
    },
  },
});

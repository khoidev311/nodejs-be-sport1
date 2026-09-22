import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // One process per test file: each file sets its own MONGODB_URI in
    // process.env, which worker threads would share (and race on).
    pool: "forks",
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    hookTimeout: 60_000,
    testTimeout: 20_000,
  },
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Property tests run many async cases; Windows timers are coarse.
    testTimeout: 30000,
  },
});

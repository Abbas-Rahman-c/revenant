import { defineConfig } from "vite";

export default defineConfig({
  root: "playground",
  worker: { format: "es" },
  server: {
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
  },
});

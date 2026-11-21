import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Cross-origin isolation lets Transformers.js use multi-threaded WebAssembly (SharedArrayBuffer).
// "credentialless" keeps cross-origin model downloads (Hugging Face) working without CORP headers.
const isolation = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "credentialless",
};

export default defineConfig({
  plugins: [react()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["circle"] },
  server: { headers: isolation },
  preview: { headers: isolation },
});

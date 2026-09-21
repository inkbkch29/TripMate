import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

function versionServiceWorker() {
  return {
    name: "tripmate-version-service-worker",
    apply: "build",
    async closeBundle() {
      const swPath = resolve("dist/sw.js");
      const source = await readFile(swPath, "utf8");
      const buildId = process.env.VERCEL_GIT_COMMIT_SHA || `${Date.now()}`;
      await writeFile(swPath, source.replaceAll("__TRIPMATE_BUILD_ID__", buildId));
    },
  };
}

export default defineConfig({
  plugins: [react(), versionServiceWorker()],
  build: { rollupOptions: { output: { manualChunks: { react:["react","react-dom"], mui:["@mui/material","@mui/icons-material","@emotion/react","@emotion/styled"], maps:["leaflet","react-leaflet"], supabase:["@supabase/supabase-js"] } } } },
  test: { environment: "jsdom", globals: true },
});

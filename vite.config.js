import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { react:["react","react-dom"], mui:["@mui/material","@mui/icons-material","@emotion/react","@emotion/styled"], maps:["leaflet","react-leaflet"], supabase:["@supabase/supabase-js"] } } } },
  test: { environment: "jsdom", globals: true },
});

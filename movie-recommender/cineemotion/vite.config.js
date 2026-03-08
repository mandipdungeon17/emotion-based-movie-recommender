import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/health": "http://localhost:5000",
      "/recommend": "http://localhost:5000",
      "/movies": "http://localhost:5000",
      "/posters": "http://localhost:5000",
      "/posters-debug": "http://localhost:5000",
    },
  },
});

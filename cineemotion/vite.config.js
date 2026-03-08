import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0", // accessible from LAN
    proxy: {
      "/health": "http://localhost:5000",
      "/recommend": "http://localhost:5000",
      "/movies": "http://localhost:5000",
      "/posters": "http://localhost:5000",
      "/posters-debug": "http://localhost:5000",
      "/rooms": "http://localhost:5000",
      "/tmdb-img": {
        target: "https://image.tmdb.org/t/p/original",
        changeOrigin: true,
        rewrite: function(path) { return path.replace(/^\/tmdb-img/, ""); },
        secure: false,
      },
    },
  },
});

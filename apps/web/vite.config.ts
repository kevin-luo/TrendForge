import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4788,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4790",
        changeOrigin: true
      }
    }
  }
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);
const BACKEND_PORT = Number(
  process.env.VITE_BACKEND_PORT || process.env.BACKEND_PORT || 3000
);

export default defineConfig({
  plugins: [react()],
  server: {
    host: HOST,
    port: PORT,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${BACKEND_PORT}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: HOST,
    port: PORT,
  },
});

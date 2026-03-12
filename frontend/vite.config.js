import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 5173);

export default defineConfig({
  plugins: [react()],
  server: {
    host: HOST,
    port: PORT,
  },
  preview: {
    host: HOST,
    port: PORT,
  },
});
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Fuso fixo: o teste da data local precisa pegar a regressão também no CI (que roda em UTC).
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    env: { TZ: "America/Sao_Paulo" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

import { defineConfig, devices } from "@playwright/test";

// Testes de ponta a ponta no navegador (npm run test:e2e).
// Por padrão usam o Google Chrome instalado. Para usar o Chromium do Playwright:
// `npx playwright install chromium` e PW_CHANNEL=chromium.
const PORT = 4173;
const canal = process.env.PW_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  // O reconhecimento roda no navegador: em máquinas lentas cada análise pode levar minutos.
  timeout: 30 * 60 * 1000,
  expect: { timeout: 10 * 60 * 1000 },
  use: {
    baseURL: `http://localhost:${PORT}/reconhecimentofacial/`,
    trace: "retain-on-failure",
    permissions: ["camera"],
    launchOptions: {
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
  projects: [
    {
      name: canal,
      use: { ...devices["Desktop Chrome"], ...(canal === "chromium" ? {} : { channel: canal }) },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/reconhecimentofacial/`,
    reuseExistingServer: !process.env.CI,
    timeout: 10 * 60 * 1000,
  },
});

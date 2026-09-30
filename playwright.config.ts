import { defineConfig, devices } from "@playwright/test";
const port = process.env.KA_SITE_PORT ?? "4173";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://127.0.0.1:${port}`, trace: "retain-on-failure" },
  webServer: {
    command: "node tools/serve-preview.mjs",
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 15000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
});

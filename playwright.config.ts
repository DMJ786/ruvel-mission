import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: false,
  workers: 1,
  use: {
    channel: "msedge",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});

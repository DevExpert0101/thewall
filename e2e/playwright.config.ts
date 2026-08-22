import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.TEST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  "",
);

if (process.env.VERCEL_ENV === "production" || process.env.THEWALL_PRODUCTION === "true") {
  throw new Error("Playwright must not run against production.");
}
if ((process.env.BASE_NETWORK || process.env.NEXT_PUBLIC_BASE_NETWORK) === "base") {
  throw new Error("Playwright must not use Base mainnet.");
}

const remote = Boolean(process.env.TEST_BASE_URL);

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: "npx next dev --turbopack --port 3000",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});

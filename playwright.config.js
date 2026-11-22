const { defineConfig, devices } = require("@playwright/test");
const { testConfig } = require("./Backend/test/helpers/database");

const config = testConfig();
const baseURL = "http://127.0.0.1:3100";

module.exports = defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm start",
    url: `${baseURL}/health/ready`,
    timeout: 30000,
    reuseExistingServer: false,
    env: {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      PORT: "3100",
      APP_ORIGIN: baseURL,
      DATABASE_URL: config.databaseUrl,
      LOG_LEVEL: "warn",
    },
  },
});

const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e-demo",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174/instaRJify/",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run preview:demo -w Frontend/my_app",
    url: "http://127.0.0.1:4174/instaRJify/",
    reuseExistingServer: false,
    timeout: 30000,
  },
});

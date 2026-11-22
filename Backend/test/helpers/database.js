const { readConfig } = require("../../config");

function testConfig(env = process.env) {
  const testUrl = env.TEST_DATABASE_URL;
  if (!testUrl)
    throw new Error(
      "TEST_DATABASE_URL is required; integration tests never fall back to the application database",
    );
  const target = new URL(testUrl);
  if (target.protocol !== "mysql:" || !/^\/[a-zA-Z0-9_]+_test$/.test(target.pathname)) {
    throw new Error(
      "TEST_DATABASE_URL must point to a MySQL database whose name ends in _test",
    );
  }
  if (env.DATABASE_URL) {
    const app = new URL(env.DATABASE_URL);
    if (
      decodeURIComponent(app.pathname).toLowerCase() === target.pathname.toLowerCase()
    ) {
      throw new Error("The test database must not be the application database");
    }
  }
  return readConfig({
    ...env,
    DATABASE_URL: testUrl,
    NODE_ENV: "test",
    APP_ORIGIN: "http://localhost:5173",
    LOG_LEVEL: "silent",
  });
}

module.exports = { testConfig };

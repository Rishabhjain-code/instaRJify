const http = require("node:http");
const pino = require("pino");
const { readConfig } = require("./config");
const { createPool } = require("./db/pool");
const { createApp } = require("./app");

async function start() {
  const config = readConfig();
  const logger = pino({ level: config.logLevel });
  const pool = createPool(config.databaseUrl);
  try {
    await pool.execute("SELECT name FROM schema_migrations LIMIT 1");
    const server = http.createServer(
      { requestTimeout: 15000, headersTimeout: 10000, keepAliveTimeout: 5000 },
      createApp({ pool, config, logger }),
    );
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(config.port, config.host, resolve);
    });
    logger.info({ host: config.host, port: config.port }, "instaRJify API is listening");
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      logger.info("Stopping HTTP server and closing the database pool");
      const timeout = setTimeout(() => server.closeAllConnections(), 10000);
      timeout.unref();
      server.close(async () => {
        try {
          await pool.end();
        } catch (error) {
          logger.error({ errorCode: error.code }, "Database shutdown failed");
          process.exitCode = 1;
        } finally {
          clearTimeout(timeout);
        }
      });
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  } catch (error) {
    await pool.end();
    throw error;
  }
}

start().catch((error) => {
  console.error(`Startup failed: ${error.code || error.message}`);
  process.exitCode = 1;
});

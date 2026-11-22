const { readConfig } = require("../config");
const { createPool } = require("../db/pool");
const { migrate } = require("../db/migrate");

async function main() {
  const pool = createPool(readConfig().databaseUrl);
  try {
    await migrate(pool);
    console.log("Database migrations are up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Migration failed: ${error.code || error.message}`);
  process.exitCode = 1;
});

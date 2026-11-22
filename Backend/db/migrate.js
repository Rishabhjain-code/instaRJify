const { createHash } = require("node:crypto");
const { readdir, readFile } = require("node:fs/promises");
const path = require("node:path");

async function migrate(pool) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[result]] = await connection.execute(
      "SELECT GET_LOCK(CONCAT(DATABASE(), ':migrate'), 30) AS acquired",
    );
    if (result.acquired !== 1)
      throw new Error("Could not acquire the database migration lock");
    locked = true;
    await connection.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(128) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at DATETIME(6) NOT NULL DEFAULT (UTC_TIMESTAMP(6))) ENGINE=InnoDB",
    );
    const directory = path.join(__dirname, "migrations");
    const files = (await readdir(directory))
      .filter((file) => /^\d+_[a-z_]+\.sql$/.test(file))
      .sort();
    for (const name of files) {
      const source = (await readFile(path.join(directory, name), "utf8")).replace(
        /\r\n/g,
        "\n",
      );
      const checksum = createHash("sha256").update(source).digest("hex");
      const [[existing]] = await connection.execute(
        "SELECT checksum FROM schema_migrations WHERE name = ?",
        [name],
      );
      if (existing) {
        if (existing.checksum !== checksum)
          throw new Error(
            `Applied migration ${name} has changed; create a new migration instead`,
          );
        continue;
      }
      for (const statement of source
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)) {
        await connection.query(statement);
      }
      await connection.execute(
        "INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)",
        [name, checksum],
      );
    }
  } finally {
    try {
      if (locked)
        await connection.execute("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':migrate'))");
    } finally {
      connection.release();
    }
  }
}

module.exports = { migrate };

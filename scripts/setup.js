const { randomBytes } = require("node:crypto");
const { writeFile } = require("node:fs/promises");
const path = require("node:path");

async function setup() {
  const password = randomBytes(24).toString("base64url");
  const values = [
    "NODE_ENV=development",
    "HOST=127.0.0.1",
    "PORT=3000",
    "APP_ORIGIN=http://localhost:5173",
    `DATABASE_URL=mysql://instarjify:${password}@127.0.0.1:3307/instarjify`,
    `TEST_DATABASE_URL=mysql://instarjify:${password}@127.0.0.1:3307/instarjify_test`,
    "MYSQL_DATABASE=instarjify",
    "MYSQL_USER=instarjify",
    `MYSQL_PASSWORD=${password}`,
    `MYSQL_ROOT_PASSWORD=${randomBytes(24).toString("base64url")}`,
    `DEMO_PASSWORD=${randomBytes(18).toString("base64url")}`,
    "LOG_LEVEL=info",
    "",
  ];
  try {
    await writeFile(path.resolve(__dirname, "..", ".env"), values.join("\n"), {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      "Created .env with random local credentials. Existing files are never overwritten.",
    );
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Kept the existing .env unchanged.");
  }
}

setup().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

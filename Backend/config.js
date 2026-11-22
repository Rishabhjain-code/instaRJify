const path = require("node:path");
const { z } = require("zod");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

function readConfig(env = process.env) {
  const values = z
    .object({
      NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
      HOST: z.string().default("127.0.0.1"),
      PORT: z.coerce.number().int().min(1).max(65535).default(3000),
      APP_ORIGIN: z.url().default("http://localhost:5173"),
      DATABASE_URL: z
        .url()
        .refine(
          (value) => new URL(value).protocol === "mysql:",
          "Use a mysql:// connection URL",
        ),
      LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),
    })
    .safeParse(env);
  if (!values.success) {
    throw new Error(
      `Invalid configuration: ${values.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
    );
  }
  const parsed = values.data;
  const origin = new URL(parsed.APP_ORIGIN);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.origin !== parsed.APP_ORIGIN
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) origin without a path or trailing slash",
    );
  }
  if (
    parsed.NODE_ENV === "production" &&
    origin.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  ) {
    throw new Error("Production APP_ORIGIN must use HTTPS except for a local demo");
  }
  return {
    env: parsed.NODE_ENV,
    host: parsed.HOST,
    port: parsed.PORT,
    appOrigin: parsed.APP_ORIGIN,
    databaseUrl: parsed.DATABASE_URL,
    secureCookie: origin.protocol === "https:",
    logLevel: parsed.LOG_LEVEL,
    sessionTtlSeconds: 60 * 60 * 24 * 7,
  };
}

module.exports = { readConfig };

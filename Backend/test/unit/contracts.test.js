const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { hashPassword, verifyPassword } = require("../../lib/passwords");
const { decodeCursor, pageOf } = require("../../lib/pagination");
const { readConfig } = require("../../config");
const schemas = require("../../middleware/validation");
const { testConfig } = require("../helpers/database");

test("password hashes are salted, verifiable, and never plaintext", async () => {
  const secret = "A long test passphrase";
  const first = await hashPassword(secret);
  const second = await hashPassword(secret);
  assert.notEqual(first, second);
  assert.ok(!first.includes(secret));
  assert.equal(await verifyPassword(secret, first), true);
  assert.equal(await verifyPassword("Wrong passphrase", first), false);
  await assert.rejects(
    verifyPassword(secret, "corrupted"),
    /Invalid stored password hash/,
  );
});

test("keyset cursors preserve microsecond timestamps and the tie-breaking identifier", () => {
  const rows = Array.from({ length: 3 }, () => ({
    id: randomUUID(),
    createdAt: "2026-01-01 10:30:45.123456",
  }));
  const page = pageOf(rows, 2);
  assert.deepEqual(page.items, rows.slice(0, 2));
  assert.deepEqual(decodeCursor(page.nextCursor), rows[1]);
  assert.equal(pageOf(rows, 3).nextCursor, null);
});

test("malformed and impossible cursors are rejected", () => {
  for (const value of [
    "!",
    "a".repeat(257),
    Buffer.from("{}").toString("base64url"),
    Buffer.from(
      JSON.stringify({ id: randomUUID(), createdAt: "2026-02-31 10:30:45.123456" }),
    ).toString("base64url"),
  ]) {
    assert.throws(() => decodeCursor(value), { code: "INVALID_CURSOR", status: 400 });
  }
});

test("profile updates reject mass assignment and empty patches", () => {
  assert.equal(
    schemas.updateProfile.safeParse({ name: "Avery", isVerified: true }).success,
    false,
  );
  assert.equal(schemas.updateProfile.safeParse({}).success, false);
  assert.equal(schemas.updateProfile.safeParse({ isPublic: "false" }).success, false);
  assert.equal(
    schemas.post.safeParse({ caption: "  ", purpose: "learning" }).success,
    false,
  );
  assert.equal(schemas.parsePage(schemas.feed, { limit: "50" }).limit, 50);
  assert.throws(() => schemas.parsePage(schemas.feed, { limit: "51" }));
});

test("production configuration requires HTTPS outside a local demo", () => {
  const env = {
    DATABASE_URL: "mysql://example:placeholder@localhost/example",
    NODE_ENV: "production",
  };
  assert.throws(
    () => readConfig({ ...env, APP_ORIGIN: "http://example.com" }),
    /must use HTTPS/,
  );
  assert.equal(
    readConfig({ ...env, APP_ORIGIN: "https://example.com" }).secureCookie,
    true,
  );
  assert.equal(
    readConfig({ ...env, APP_ORIGIN: "http://localhost:3000" }).secureCookie,
    false,
  );
  assert.throws(
    () => readConfig({ ...env, APP_ORIGIN: "https://example.com/path" }),
    /without a path/,
  );
});

test("test database guards reject the application database even through a host alias", () => {
  assert.throws(() => testConfig({}), /TEST_DATABASE_URL is required/);
  assert.throws(
    () => testConfig({ TEST_DATABASE_URL: "mysql://example:placeholder@localhost/live" }),
    /ends in _test/,
  );
  assert.throws(
    () =>
      testConfig({
        DATABASE_URL: "mysql://example:placeholder@127.0.0.1:3306/project_test",
        TEST_DATABASE_URL: "mysql://example:placeholder@localhost/project_test",
      }),
    /must not be the application database/,
  );
});

test("cursor years outside MySQL DATETIME's supported range are rejected before SQL", () => {
  const cursor = Buffer.from(
    JSON.stringify({ id: randomUUID(), createdAt: "0000-01-01 10:30:45.123456" }),
  ).toString("base64url");
  assert.throws(() => decodeCursor(cursor), { code: "INVALID_CURSOR", status: 400 });
});

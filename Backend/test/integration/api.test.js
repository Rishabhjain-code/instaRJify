const { test, before, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { fork } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const request = require("supertest");
const sharp = require("sharp");
const { createApp } = require("../../app");
const { createPool } = require("../../db/pool");
const { migrate } = require("../../db/migrate");
const { testConfig } = require("../helpers/database");

const config = testConfig();
const pool = createPool(config.databaseUrl);
const origin = config.appOrigin;
const password = "A test-only passphrase!";
let app;
let counter = 0;
let image;

before(async () => {
  await migrate(pool);
  image = await sharp({
    create: { width: 24, height: 24, channels: 3, background: "#348574" },
  })
    .png()
    .toBuffer();
});
beforeEach(async () => {
  for (const table of [
    "post_requests",
    "post_images",
    "user_avatars",
    "posts",
    "follows",
    "sessions",
    "users",
  ])
    await pool.query(`DELETE FROM ${table}`);
  app = createApp({ pool, config });
});
after(() => pool.end());

async function account(overrides = {}) {
  const number = ++counter;
  const agent = request.agent(app);
  const input = {
    name: `Test Creator ${number}`,
    handle: `creator_${number}`,
    email: `creator${number}@example.test`,
    password,
    ...overrides,
  };
  const response = await agent
    .post("/api/v1/auth/register")
    .set("Origin", origin)
    .send(input)
    .expect(201);
  return {
    agent,
    user: response.body.data,
    input,
    cookie: response.headers["set-cookie"][0].split(";")[0],
  };
}

async function post(agent, input = {}, key = randomUUID()) {
  return agent
    .post("/api/v1/posts")
    .set("Origin", origin)
    .set("Idempotency-Key", key)
    .send({ caption: "A useful idea worth sharing", purpose: "learning", ...input });
}

test("authentication rotates opaque cookies, hides password hashes, and revokes sessions", async () => {
  const creator = await account();
  assert.equal(creator.user.email, creator.input.email);
  assert.ok(!JSON.stringify(creator.user).includes("password"));
  const [[stored]] = await pool.execute(
    "SELECT password_hash AS hash FROM users WHERE id = ?",
    [creator.user.id],
  );
  assert.notEqual(stored.hash, password);
  const login = await creator.agent
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({ email: creator.input.email, password })
    .expect(200);
  assert.match(login.headers["set-cookie"][0], /HttpOnly/);
  assert.match(login.headers["set-cookie"][0], /SameSite=Strict/);
  await request(app).get("/api/v1/auth/me").set("Cookie", creator.cookie).expect(401);
  await creator.agent.post("/api/v1/auth/logout").set("Origin", origin).expect(204);
  await creator.agent.get("/api/v1/auth/me").expect(401);
});

test("expired sessions cannot authenticate even before physical cleanup", async () => {
  const creator = await account();
  await pool.execute(
    "UPDATE sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(6), INTERVAL 1 SECOND) WHERE user_id = ?",
    [creator.user.id],
  );
  await creator.agent.get("/api/v1/auth/me").expect(401);
});

test("unknown and incorrect credentials have the same public error", async () => {
  const creator = await account();
  const first = await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({ email: "missing@example.test", password })
    .expect(401);
  const second = await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({ email: creator.input.email, password: "incorrect" })
    .expect(401);
  assert.equal(first.body.error.code, second.body.error.code);
  assert.equal(first.body.error.message, second.body.error.message);
});

test("writes require the configured Origin and invalid bodies get structured errors", async () => {
  const creator = await account();
  await creator.agent.patch("/api/v1/users/me").send({ name: "No origin" }).expect(403);
  await creator.agent
    .patch("/api/v1/users/me")
    .set("Origin", "https://untrusted.example")
    .send({ name: "Wrong origin" })
    .expect(403);
  const invalid = await creator.agent
    .patch("/api/v1/users/me")
    .set("Origin", origin)
    .send({ isVerified: true })
    .expect(400);
  assert.equal(invalid.body.error.code, "VALIDATION_ERROR");
  assert.match(invalid.headers["x-request-id"], /^[a-f0-9-]{36}$/);
  const malformed = await creator.agent
    .patch("/api/v1/users/me")
    .set("Origin", origin)
    .set("Content-Type", "application/json")
    .send("{")
    .expect(400);
  assert.equal(malformed.body.error.code, "INVALID_JSON");
  const huge = await creator.agent
    .patch("/api/v1/users/me")
    .set("Origin", origin)
    .send({ bio: "x".repeat(20000) })
    .expect(413);
  assert.equal(huge.body.error.code, "BODY_TOO_LARGE");
});

test("duplicate accounts conflict and public profiles exclude email", async () => {
  const first = await account();
  const second = await account();
  await request(app)
    .post("/api/v1/auth/register")
    .set("Origin", origin)
    .send(first.input)
    .expect(409);
  const response = await second.agent.get(`/api/v1/users/${first.user.id}`).expect(200);
  assert.equal(response.body.data.email, undefined);
  assert.equal(response.body.data.passwordHash, undefined);
});

test("private posts and images require an accepted relationship, including after revocation", async () => {
  const owner = await account({ isPublic: false });
  const viewer = await account();
  const stranger = await account();
  const created = await owner.agent
    .post("/api/v1/posts")
    .set("Origin", origin)
    .set("Idempotency-Key", randomUUID())
    .field("caption", "A private learning note")
    .field("purpose", "learning")
    .attach("image", image, { filename: "note.png", contentType: "image/png" })
    .expect(201);
  const id = created.body.data.id;
  await viewer.agent.get(`/api/v1/posts/${id}`).expect(404);
  await viewer.agent.get(`/api/v1/posts/${id}/image`).expect(404);
  await viewer.agent.get(`/api/v1/users/${owner.user.id}/posts`).expect(403);
  await viewer.agent.get(`/api/v1/users/${owner.user.id}/followers`).expect(403);
  assert.equal(
    (
      await viewer.agent
        .put(`/api/v1/follows/${owner.user.id}`)
        .set("Origin", origin)
        .expect(200)
    ).body.data.status,
    "pending",
  );
  await stranger.agent
    .put(`/api/v1/follows/${viewer.user.id}/accept`)
    .set("Origin", origin)
    .expect(404);
  await viewer.agent.get(`/api/v1/posts/${id}`).expect(404);
  const pending = await owner.agent.get("/api/v1/users/me/requests").expect(200);
  assert.equal(pending.body.data.items[0].id, viewer.user.id);
  await owner.agent
    .put(`/api/v1/follows/${viewer.user.id}/accept`)
    .set("Origin", origin)
    .expect(200);
  await viewer.agent.get(`/api/v1/posts/${id}`).expect(200);
  const media = await viewer.agent
    .get(`/api/v1/posts/${id}/image`)
    .expect(200)
    .expect("Content-Type", /image\/webp/);
  assert.equal(media.headers["cache-control"], "no-store");
  const discover = await viewer.agent.get("/api/v1/posts?scope=discover").expect(200);
  assert.equal(discover.body.data.items.length, 0);
  await owner.agent
    .delete(`/api/v1/followers/${viewer.user.id}`)
    .set("Origin", origin)
    .expect(204);
  await viewer.agent.get(`/api/v1/posts/${id}/image`).expect(404);
});

test("only the author can edit or delete posts; SQL metacharacters remain literal", async () => {
  const owner = await account();
  const other = await account();
  const caption = "A quote: '); DROP TABLE users; --";
  const created = await post(owner.agent, { caption });
  assert.equal(created.status, 201);
  const id = created.body.data.id;
  assert.equal(created.body.data.caption, caption);
  await other.agent
    .patch(`/api/v1/posts/${id}`)
    .set("Origin", origin)
    .send({ caption: "Not mine", purpose: "fitness" })
    .expect(404);
  await other.agent.delete(`/api/v1/posts/${id}`).set("Origin", origin).expect(404);
  const updated = await owner.agent
    .patch(`/api/v1/posts/${id}`)
    .set("Origin", origin)
    .send({ caption: "An edited learning note", purpose: "learning" })
    .expect(200);
  assert.equal(updated.body.data.caption, "An edited learning note");
  const [[count]] = await pool.execute("SELECT COUNT(*) AS total FROM users");
  assert.equal(count.total, 2);
});

test("post retries replay one result, reject changed input, and do not resurrect deleted posts", async () => {
  const creator = await account();
  const key = randomUUID();
  const first = await post(creator.agent, {}, key);
  const replay = await post(creator.agent, {}, key);
  assert.equal(first.status, 201);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.id, first.body.data.id);
  assert.equal(replay.headers["idempotency-replayed"], "true");
  assert.equal(
    (await post(creator.agent, { caption: "Different input" }, key)).status,
    409,
  );
  await creator.agent
    .delete(`/api/v1/posts/${first.body.data.id}`)
    .set("Origin", origin)
    .expect(204);
  const deletedReplay = await post(creator.agent, {}, key);
  assert.equal(deletedReplay.status, 409);
  assert.equal(deletedReplay.body.error.code, "POST_ALREADY_DELETED");
  await creator.agent
    .post("/api/v1/posts")
    .set("Origin", origin)
    .send({ caption: "No retry key", purpose: "learning" })
    .expect(400);
});

test(
  "two separate Node processes create exactly one post for a shared idempotency key",
  { timeout: 20000 },
  async (t) => {
    const creator = await account();
    const children = Array.from({ length: 2 }, () =>
      fork(path.join(__dirname, "..", "helpers", "post-worker.js"), [], {
        stdio: ["ignore", "ignore", "pipe", "ipc"],
      }),
    );
    t.after(() => {
      for (const child of children) if (child.exitCode === null) child.kill();
    });
    await Promise.all(children.map((child) => once(child, "message")));
    const responses = children.map((child) => once(child, "message"));
    const key = randomUUID();
    for (const child of children) child.send({ authorId: creator.user.id, key });
    const results = (await Promise.all(responses)).map(([message]) => message);
    assert.ok(
      results.every((result) => !result.error),
      JSON.stringify(results),
    );
    assert.equal(new Set(results.map((result) => result.id)).size, 1);
    assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true]);
    const [[count]] = await pool.execute("SELECT COUNT(*) AS total FROM posts");
    assert.equal(count.total, 1);
  },
);

test("simultaneous duplicate and reciprocal follows preserve one canonical edge", async () => {
  const first = await account();
  const second = await account();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const operations = Array.from({ length: 12 }, async (_, index) => {
    await gate;
    const [actor, target] = index % 2 ? [first, second] : [second, first];
    return actor.agent
      .put(`/api/v1/follows/${target.user.id}`)
      .set("Origin", origin)
      .expect(200);
  });
  release();
  await Promise.all(operations);
  const [[count]] = await pool.execute("SELECT COUNT(*) AS total FROM follows");
  assert.equal(count.total, 2);
  const profile = await first.agent.get(`/api/v1/users/${second.user.id}`).expect(200);
  assert.equal(profile.body.data.followersCount, 1);
  await first.agent
    .put(`/api/v1/follows/${first.user.id}`)
    .set("Origin", origin)
    .expect(400);
  await Promise.all(
    Array.from({ length: 5 }, () =>
      first.agent
        .delete(`/api/v1/follows/${second.user.id}`)
        .set("Origin", origin)
        .expect(204),
    ),
  );
  assert.equal(
    (await second.agent.get(`/api/v1/users/${second.user.id}/followers`).expect(200)).body
      .data.items.length,
    0,
  );
});

test("accept retries are idempotent and making an account public atomically accepts pending requests", async () => {
  const owner = await account({ isPublic: false });
  const first = await account();
  const second = await account();
  await first.agent
    .put(`/api/v1/follows/${owner.user.id}`)
    .set("Origin", origin)
    .expect(200);
  await second.agent
    .put(`/api/v1/follows/${owner.user.id}`)
    .set("Origin", origin)
    .expect(200);
  await Promise.all(
    Array.from({ length: 5 }, () =>
      owner.agent
        .put(`/api/v1/follows/${first.user.id}/accept`)
        .set("Origin", origin)
        .expect(200),
    ),
  );
  await owner.agent
    .patch("/api/v1/users/me")
    .set("Origin", origin)
    .send({ isPublic: true })
    .expect(200);
  assert.equal(
    (await owner.agent.get("/api/v1/users/me/requests").expect(200)).body.data.items
      .length,
    0,
  );
  const [[count]] = await pool.execute(
    "SELECT COUNT(*) AS total FROM follows WHERE following_id = ? AND status = 'accepted'",
    [owner.user.id],
  );
  assert.equal(count.total, 2);
  await owner.agent
    .patch("/api/v1/users/me")
    .set("Origin", origin)
    .send({ isPublic: false })
    .expect(200);
  assert.equal(
    (await first.agent.get(`/api/v1/users/${owner.user.id}`).expect(200)).body.data
      .relationship,
    "accepted",
  );
});

test("keyset pagination is stable across equal timestamps and a new first-page insertion", async () => {
  const creator = await account();
  const ids = [];
  for (let index = 0; index < 5; index++)
    ids.push((await post(creator.agent, { caption: `Note ${index}` })).body.data.id);
  await pool.execute("UPDATE posts SET created_at = '2026-01-01 10:30:45.123456'");
  const first = await creator.agent.get("/api/v1/posts?scope=mine&limit=2").expect(200);
  await post(creator.agent, { caption: "Inserted after page one" });
  const second = await creator.agent
    .get(`/api/v1/posts?scope=mine&limit=2&cursor=${first.body.data.nextCursor}`)
    .expect(200);
  const third = await creator.agent
    .get(`/api/v1/posts?scope=mine&limit=2&cursor=${second.body.data.nextCursor}`)
    .expect(200);
  const seen = [
    ...first.body.data.items,
    ...second.body.data.items,
    ...third.body.data.items,
  ].map((item) => item.id);
  assert.deepEqual([...seen].sort(), ids.sort());
  assert.equal(new Set(seen).size, 5);
  assert.equal(third.body.data.nextCursor, null);
  await creator.agent.get("/api/v1/posts?cursor=not-valid-json").expect(400);
  await creator.agent.get("/api/v1/posts?limit=9999").expect(400);
});

test("suggestions rank second-degree connections without duplicates or private candidates", async () => {
  const viewer = await account();
  const left = await account();
  const right = await account();
  const candidate = await account();
  await account({ isPublic: false });
  for (const target of [left, right])
    await viewer.agent
      .put(`/api/v1/follows/${target.user.id}`)
      .set("Origin", origin)
      .expect(200);
  for (const actor of [left, right])
    await actor.agent
      .put(`/api/v1/follows/${candidate.user.id}`)
      .set("Origin", origin)
      .expect(200);
  const response = await viewer.agent
    .get("/api/v1/users/suggestions?limit=1")
    .expect(200);
  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].id, candidate.user.id);
  assert.equal(response.body.data[0].mutualCount, 2);
});

test("image validation checks decoded content, size limits, and avatar persistence", async () => {
  const creator = await account();
  await creator.agent
    .post("/api/v1/posts")
    .set("Origin", origin)
    .set("Idempotency-Key", randomUUID())
    .field("caption", "Invalid image")
    .field("purpose", "learning")
    .attach("image", Buffer.from("<script>not a PNG</script>"), {
      filename: "not-an-image.png",
      contentType: "image/png",
    })
    .expect(415);
  await creator.agent
    .put("/api/v1/users/me/avatar")
    .set("Origin", origin)
    .attach("image", Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: "too-large.png",
      contentType: "image/png",
    })
    .expect(413);
  const saved = await creator.agent
    .put("/api/v1/users/me/avatar")
    .set("Origin", origin)
    .attach("image", image, { filename: "avatar.png", contentType: "image/png" })
    .expect(200);
  assert.equal(saved.body.data.hasAvatar, true);
  await creator.agent
    .get(`/api/v1/users/${creator.user.id}/avatar`)
    .expect(200)
    .expect("Content-Type", /image\/webp/);
});

test("a failed image write rolls back the post and retry record, then permits a clean retry", async (t) => {
  const creator = await account();
  const key = randomUUID();
  await pool.query(
    "CREATE TRIGGER fail_image BEFORE INSERT ON post_images FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'injected test failure'",
  );
  t.after(() => pool.query("DROP TRIGGER IF EXISTS fail_image"));
  const submit = () =>
    creator.agent
      .post("/api/v1/posts")
      .set("Origin", origin)
      .set("Idempotency-Key", key)
      .field("caption", "An atomic image post")
      .field("purpose", "learning")
      .attach("image", image, { filename: "note.png", contentType: "image/png" });
  const failed = await submit().expect(500);
  assert.equal(failed.body.error.code, "INTERNAL_ERROR");
  assert.ok(!JSON.stringify(failed.body).includes("injected"));
  const [[count]] = await pool.execute(
    "SELECT (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM post_requests) AS requests",
  );
  assert.deepEqual(count, { posts: 0, requests: 0 });
  await pool.query("DROP TRIGGER fail_image");
  await submit().expect(201);
});

test("account deletion requires the password and cascades sessions, posts, and relationships", async () => {
  const creator = await account();
  const viewer = await account();
  await post(creator.agent);
  await viewer.agent
    .put(`/api/v1/follows/${creator.user.id}`)
    .set("Origin", origin)
    .expect(200);
  await creator.agent
    .delete("/api/v1/users/me")
    .set("Origin", origin)
    .send({ password: "incorrect" })
    .expect(401);
  await creator.agent
    .delete("/api/v1/users/me")
    .set("Origin", origin)
    .send({ password })
    .expect(204);
  await request(app).get("/api/v1/auth/me").set("Cookie", creator.cookie).expect(401);
  const [[count]] = await pool.execute(
    "SELECT (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM follows) AS follows, (SELECT COUNT(*) FROM post_requests) AS requests",
  );
  assert.deepEqual(count, { posts: 0, follows: 0, requests: 0 });
});

test("authentication has an enforced per-process attempt limit", async () => {
  for (let index = 0; index < 20; index++)
    await request(app)
      .post("/api/v1/auth/login")
      .set("Origin", origin)
      .send({})
      .expect(400);
  await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", origin)
    .send({})
    .expect(429);
});

test("readiness reflects database availability while liveness remains independent", async () => {
  await request(app).get("/health/ready").expect(200);
  const unavailable = createApp({
    config,
    pool: {
      execute: async () => {
        const error = new Error("offline");
        error.code = "ECONNREFUSED";
        throw error;
      },
    },
  });
  await request(unavailable).get("/health/live").expect(200);
  await request(unavailable).get("/health/ready").expect(503);
});

test("feed and suggestions use a bounded query count rather than one author query per result", async () => {
  const creator = await account();
  for (let index = 0; index < 4; index++)
    await post(creator.agent, { caption: `Query-count note ${index}` });
  const queries = [];
  const observed = createApp({
    config,
    pool: {
      execute: (sql, values) => {
        queries.push(sql);
        return pool.execute(sql, values);
      },
      getConnection: () => pool.getConnection(),
    },
  });
  const response = await request(observed)
    .get("/api/v1/posts?scope=discover")
    .set("Cookie", creator.cookie)
    .expect(200);
  assert.equal(response.body.data.items.length, 4);
  assert.equal(queries.length, 2, "One session lookup and one joined feed query");
  queries.length = 0;
  await request(observed)
    .get("/api/v1/users/suggestions")
    .set("Cookie", creator.cookie)
    .expect(200);
  assert.equal(queries.length, 2, "One session lookup and one graph suggestion query");
});

test("migrations can run concurrently and reject edits to an applied migration", async () => {
  await Promise.all([migrate(pool), migrate(pool)]);
  const [[original]] = await pool.execute(
    "SELECT name, checksum FROM schema_migrations ORDER BY name LIMIT 1",
  );
  try {
    await pool.execute("UPDATE schema_migrations SET checksum = ? WHERE name = ?", [
      "0".repeat(64),
      original.name,
    ]);
    await assert.rejects(migrate(pool), /has changed/);
  } finally {
    await pool.execute("UPDATE schema_migrations SET checksum = ? WHERE name = ?", [
      original.checksum,
      original.name,
    ]);
  }
});

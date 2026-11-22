const { createPool } = require("../../db/pool");
const { createPostService } = require("../../services/postService");
const { createUserService } = require("../../services/userService");
const { testConfig } = require("./database");

const pool = createPool(testConfig().databaseUrl);
const service = createPostService(pool, createUserService(pool));
process.once("message", async ({ authorId, key }) => {
  try {
    const result = await service.create(
      authorId,
      { caption: "One logical post", purpose: "learning" },
      null,
      key,
    );
    process.send({ id: result.post.id, replayed: result.replayed });
  } catch (error) {
    process.send({ error: error.code || error.message });
    process.exitCode = 1;
  } finally {
    await pool.end();
    process.disconnect();
  }
});
process.send({ ready: true });

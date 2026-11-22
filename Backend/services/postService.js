const { createHash, randomUUID } = require("node:crypto");
const users = require("../repositories/users");
const posts = require("../repositories/posts");
const { transaction } = require("../db/pool");
const { pageOf } = require("../lib/pagination");
const { prepareImage } = require("../lib/media");
const { AppError } = require("../lib/errors");

function createPostService(pool, userService) {
  return {
    async list(viewerId, options) {
      if (options.authorId)
        await userService.requireVisibility(options.authorId, viewerId);
      return pageOf(await posts.list(pool, viewerId, options), options.limit);
    },
    async get(id, viewerId) {
      const post = await posts.find(pool, id, viewerId);
      if (!post)
        throw new AppError(
          404,
          "POST_NOT_FOUND",
          "The post does not exist or is not visible to you",
        );
      return post;
    },
    async create(authorId, input, file, key) {
      const bytes = await prepareImage(file);
      const requestHash = createHash("sha256")
        .update(JSON.stringify([input.caption, input.purpose]))
        .update(file?.buffer || Buffer.alloc(0))
        .digest("hex");
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [authorId]);
        const previous = await posts.findRequest(db, authorId, key);
        if (previous) {
          if (previous.requestHash !== requestHash)
            throw new AppError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "This request key was already used with different content",
            );
          if (!previous.postId)
            throw new AppError(
              409,
              "POST_ALREADY_DELETED",
              "This request was already completed and its post has been deleted",
            );
          return {
            post: await posts.find(db, previous.postId, authorId),
            replayed: true,
          };
        }
        const post = { ...input, id: randomUUID(), authorId };
        await posts.insert(db, post, bytes, key, requestHash);
        return { post: await posts.find(db, post.id, authorId), replayed: false };
      });
    },
    async update(id, authorId, input) {
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [authorId]);
        if (!(await posts.findOwned(db, id, authorId)))
          throw new AppError(
            404,
            "POST_NOT_FOUND",
            "The post does not exist or is not owned by you",
          );
        await posts.update(db, id, authorId, input.caption, input.purpose);
        return posts.find(db, id, authorId);
      });
    },
    async remove(id, authorId) {
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [authorId]);
        if (!(await posts.remove(db, id, authorId)))
          throw new AppError(
            404,
            "POST_NOT_FOUND",
            "The post does not exist or is not owned by you",
          );
      });
    },
    async image(id, viewerId) {
      const bytes = await posts.image(pool, id, viewerId);
      if (!bytes)
        throw new AppError(
          404,
          "IMAGE_NOT_FOUND",
          "The image does not exist or is not visible to you",
        );
      return bytes;
    },
  };
}

module.exports = { createPostService };

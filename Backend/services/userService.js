const users = require("../repositories/users");
const follows = require("../repositories/follows");
const { transaction } = require("../db/pool");
const { pageOf } = require("../lib/pagination");
const { prepareImage } = require("../lib/media");
const { AppError } = require("../lib/errors");

function createUserService(pool) {
  async function getProfile(id, viewerId) {
    const user = await users.profile(pool, id, viewerId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "The user does not exist");
    return user;
  }

  async function requireVisibility(id, viewerId) {
    const user = await getProfile(id, viewerId);
    if (!user.isPublic && !["self", "accepted"].includes(user.relationship)) {
      throw new AppError(
        403,
        "PRIVATE_ACCOUNT",
        "Follow this private account to view its content",
      );
    }
    return user;
  }

  return {
    getProfile,
    requireVisibility,
    async list(options, viewerId) {
      return pageOf(await users.list(pool, options, viewerId), options.limit);
    },
    async update(id, changes) {
      return transaction(pool, async (db) => {
        const locked = await users.lockUsers(db, [id]);
        await users.update(db, id, changes);
        if (!locked.get(id).isPublic && changes.isPublic === true)
          await follows.acceptPending(db, id);
        return users.findMe(db, id);
      });
    },
    async saveAvatar(id, file) {
      if (!file) throw new AppError(400, "IMAGE_REQUIRED", "Choose an image to upload");
      const bytes = await prepareImage(file);
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [id]);
        await users.saveAvatar(db, id, bytes);
        return users.findMe(db, id);
      });
    },
    async avatar(id) {
      const bytes = await users.avatar(pool, id);
      if (!bytes) throw new AppError(404, "IMAGE_NOT_FOUND", "The avatar does not exist");
      return bytes;
    },
  };
}

module.exports = { createUserService };

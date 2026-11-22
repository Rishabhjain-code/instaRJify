const users = require("../repositories/users");
const follows = require("../repositories/follows");
const { transaction } = require("../db/pool");
const { pageOf } = require("../lib/pagination");
const { AppError } = require("../lib/errors");

function createFollowService(pool, userService) {
  async function mutate(actorId, targetId, operation) {
    if (actorId === targetId)
      throw new AppError(400, "SELF_FOLLOW", "You cannot follow yourself");
    return transaction(pool, async (db) => {
      const locked = await users.lockUsers(db, [actorId, targetId]);
      return operation(db, locked);
    });
  }

  return {
    follow(actorId, targetId) {
      return mutate(actorId, targetId, async (db, locked) => ({
        status: await follows.put(
          db,
          actorId,
          targetId,
          locked.get(targetId).isPublic ? "accepted" : "pending",
        ),
      }));
    },
    unfollow(actorId, targetId) {
      return mutate(actorId, targetId, (db) => follows.remove(db, actorId, targetId));
    },
    accept(actorId, requesterId) {
      return mutate(actorId, requesterId, async (db) => {
        if (!(await follows.accept(db, requesterId, actorId)))
          throw new AppError(
            404,
            "REQUEST_NOT_FOUND",
            "The follow request does not exist",
          );
        return { status: "accepted" };
      });
    },
    removeFollower(actorId, followerId) {
      return mutate(actorId, followerId, (db) => follows.remove(db, followerId, actorId));
    },
    async list(userId, viewerId, kind, options) {
      if (kind !== "requests") await userService.requireVisibility(userId, viewerId);
      return pageOf(
        await follows.list(pool, userId, viewerId, kind, options),
        options.limit,
      );
    },
    async suggestions(userId, limit) {
      return follows.suggestions(pool, userId, limit);
    },
  };
}

module.exports = { createFollowService };

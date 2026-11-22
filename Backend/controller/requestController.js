const schemas = require("../middleware/validation");

function createRequestController(followService) {
  return {
    async follow(req, res) {
      res.json({
        data: await followService.follow(
          req.user.id,
          schemas.uuid.parse(req.params.userId),
        ),
      });
    },
    async unfollow(req, res) {
      await followService.unfollow(req.user.id, schemas.uuid.parse(req.params.userId));
      res.sendStatus(204);
    },
    async accept(req, res) {
      res.json({
        data: await followService.accept(
          req.user.id,
          schemas.uuid.parse(req.params.userId),
        ),
      });
    },
    async remove(req, res) {
      await followService.removeFollower(
        req.user.id,
        schemas.uuid.parse(req.params.userId),
      );
      res.sendStatus(204);
    },
    async requests(req, res) {
      res.json({
        data: await followService.list(
          req.user.id,
          req.user.id,
          "requests",
          schemas.parsePage(schemas.page, req.query),
        ),
      });
    },
    async followers(req, res) {
      res.json({
        data: await followService.list(
          schemas.uuid.parse(req.params.userId),
          req.user.id,
          "followers",
          schemas.parsePage(schemas.page, req.query),
        ),
      });
    },
    async following(req, res) {
      res.json({
        data: await followService.list(
          schemas.uuid.parse(req.params.userId),
          req.user.id,
          "following",
          schemas.parsePage(schemas.page, req.query),
        ),
      });
    },
  };
}

module.exports = { createRequestController };

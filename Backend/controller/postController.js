const schemas = require("../middleware/validation");

function createPostController(postService) {
  return {
    async list(req, res) {
      res.json({
        data: await postService.list(
          req.user.id,
          schemas.parsePage(schemas.feed, req.query),
        ),
      });
    },
    async byUser(req, res) {
      res.json({
        data: await postService.list(req.user.id, {
          ...schemas.parsePage(schemas.page, req.query),
          authorId: schemas.uuid.parse(req.params.userId),
        }),
      });
    },
    async get(req, res) {
      res.json({
        data: await postService.get(schemas.uuid.parse(req.params.postId), req.user.id),
      });
    },
    async create(req, res) {
      const key = schemas.uuid.parse(req.get("Idempotency-Key"));
      const result = await postService.create(
        req.user.id,
        schemas.post.parse(req.body),
        req.file,
        key,
      );
      res
        .status(result.replayed ? 200 : 201)
        .set("Idempotency-Replayed", String(result.replayed))
        .json({ data: result.post });
    },
    async update(req, res) {
      res.json({
        data: await postService.update(
          schemas.uuid.parse(req.params.postId),
          req.user.id,
          schemas.post.parse(req.body),
        ),
      });
    },
    async remove(req, res) {
      await postService.remove(schemas.uuid.parse(req.params.postId), req.user.id);
      res.sendStatus(204);
    },
    async image(req, res) {
      res
        .type("webp")
        .send(
          await postService.image(schemas.uuid.parse(req.params.postId), req.user.id),
        );
    },
  };
}

module.exports = { createPostController };

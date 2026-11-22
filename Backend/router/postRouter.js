const { Router } = require("express");

function createPostRouter(controller, upload) {
  const router = Router();
  router.get("/posts", controller.list);
  router.post("/posts", upload(controller.create));
  router.get("/posts/:postId", controller.get);
  router.patch("/posts/:postId", controller.update);
  router.delete("/posts/:postId", controller.remove);
  router.get("/posts/:postId/image", controller.image);
  router.get("/users/:userId/posts", controller.byUser);
  return router;
}

module.exports = { createPostRouter };

const { Router } = require("express");

function createRequestRouter(controller) {
  const router = Router();
  router.put("/follows/:userId", controller.follow);
  router.delete("/follows/:userId", controller.unfollow);
  router.put("/follows/:userId/accept", controller.accept);
  router.delete("/followers/:userId", controller.remove);
  return router;
}

module.exports = { createRequestRouter };

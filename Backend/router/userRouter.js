const { Router } = require("express");
const { rateLimit } = require("express-rate-limit");

function createAuthRouter(controller, auth) {
  const router = Router();
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Too many sign-in attempts; try again in 15 minutes",
      },
    },
  });
  router.post("/auth/register", authLimit, controller.register);
  router.post("/auth/login", authLimit, controller.login);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", auth, controller.me);
  router.get("/auth/session", controller.session);
  return router;
}

function createUserRouter(controller, requests, upload) {
  const router = Router();
  router.get("/users", controller.list);
  router.get("/users/suggestions", controller.suggestions);
  router.patch("/users/me", controller.update);
  router.delete("/users/me", controller.remove);
  router.put("/users/me/avatar", upload(controller.saveAvatar));
  router.get("/users/me/requests", requests.requests);
  router.get("/users/:userId", controller.profile);
  router.get("/users/:userId/avatar", controller.avatar);
  router.get("/users/:userId/followers", requests.followers);
  router.get("/users/:userId/following", requests.following);
  return router;
}

module.exports = { createAuthRouter, createUserRouter };

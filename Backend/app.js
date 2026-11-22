const { randomUUID } = require("node:crypto");
const { existsSync } = require("node:fs");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const pino = require("pino");
const pinoHttp = require("pino-http");
const { rateLimit } = require("express-rate-limit");
const { createAuthService } = require("./services/authService");
const { createUserService } = require("./services/userService");
const { createPostService } = require("./services/postService");
const { createFollowService } = require("./services/followService");
const { createUserController } = require("./controller/userController");
const { createPostController } = require("./controller/postController");
const { createRequestController } = require("./controller/requestController");
const { createAuthRouter, createUserRouter } = require("./router/userRouter");
const { createPostRouter } = require("./router/postRouter");
const { createRequestRouter } = require("./router/requestRouter");
const { requireAuth, requireOrigin } = require("./middleware/auth");
const { errorHandler } = require("./middleware/errors");
const { AppError } = require("./lib/errors");
const { createUploadHandler } = require("./middleware/uploadGate");

function createApp({ pool, config, logger = pino({ level: config.logLevel }) }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(
    pinoHttp({
      logger,
      genReqId(_req, res) {
        const id = randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      serializers: {
        req(req) {
          return { id: req.id, method: req.method, path: req.url.split("?")[0] };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
      autoLogging: { ignore: (req) => req.url.startsWith("/health/") },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "img-src": ["'self'", "blob:", "data:"],
          "upgrade-insecure-requests": config.secureCookie ? [] : null,
        },
      },
    }),
  );
  app.get("/health/live", (_req, res) => res.json({ status: "up" }));
  app.get("/health/ready", async (_req, res) => {
    try {
      await pool.execute("SELECT 1");
      res.json({ status: "ready" });
    } catch (error) {
      logger.warn({ errorCode: error.code }, "Database readiness check failed");
      res.status(503).json({ status: "not_ready" });
    }
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(
    "/api/v1",
    requireOrigin(config),
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 600,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: { code: "RATE_LIMITED", message: "Too many requests; try again later" },
      },
    }),
  );
  app.use(express.json({ limit: "16kb" }));

  const authService = createAuthService(pool, config);
  const userService = createUserService(pool);
  const followService = createFollowService(pool, userService);
  const postService = createPostService(pool, userService);
  const auth = requireAuth(authService);
  const receive = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 1,
      fields: 4,
      fieldSize: 10000,
      parts: 5,
    },
  });
  const requests = createRequestController(followService);
  const upload = createUploadHandler(receive.single("image"));
  const users = createUserController({ authService, userService, followService, config });
  const posts = createPostController(postService);
  app.use("/api/v1", createAuthRouter(users, auth));
  app.use("/api/v1", auth);
  app.use("/api/v1", createUserRouter(users, requests, upload));
  app.use("/api/v1", createPostRouter(posts, upload));
  app.use("/api/v1", createRequestRouter(requests));
  app.use("/api", (_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "The API endpoint does not exist")),
  );

  const webRoot = path.resolve(__dirname, "..", "Frontend", "my_app", "dist");
  if (existsSync(path.join(webRoot, "index.html"))) {
    app.use(express.static(webRoot, { index: false, maxAge: "1h" }));
    app.get("/{*path}", (_req, res) =>
      res.set("Cache-Control", "no-cache").sendFile(path.join(webRoot, "index.html")),
    );
  }
  app.use((_req, _res, next) =>
    next(new AppError(404, "NOT_FOUND", "The requested resource does not exist")),
  );
  app.use(errorHandler(logger));
  return app;
}

module.exports = { createApp };

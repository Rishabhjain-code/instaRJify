const { z } = require("zod");
const schemas = require("../middleware/validation");
const { sessionToken, setSession, clearSession } = require("../middleware/auth");

function createUserController({ authService, userService, followService, config }) {
  return {
    async register(req, res) {
      const result = await authService.register(
        schemas.registration.parse(req.body),
        sessionToken(req),
      );
      setSession(res, result.token, config);
      res.status(201).json({ data: result.user });
    },
    async login(req, res) {
      const result = await authService.login(
        schemas.login.parse(req.body),
        sessionToken(req),
      );
      setSession(res, result.token, config);
      res.json({ data: result.user });
    },
    async logout(req, res) {
      await authService.logout(sessionToken(req));
      clearSession(res, config);
      res.sendStatus(204);
    },
    me(req, res) {
      res.json({ data: req.user });
    },
    async session(req, res) {
      res.json({ data: await authService.authenticate(sessionToken(req)) });
    },
    async update(req, res) {
      res.json({
        data: await userService.update(
          req.user.id,
          schemas.updateProfile.parse(req.body),
        ),
      });
    },
    async remove(req, res) {
      const { password } = z
        .object({ password: z.string().min(1).max(128) })
        .strict()
        .parse(req.body);
      await authService.deleteAccount(req.user.id, password);
      clearSession(res, config);
      res.sendStatus(204);
    },
    async profile(req, res) {
      res.json({
        data: await userService.getProfile(
          schemas.uuid.parse(req.params.userId),
          req.user.id,
        ),
      });
    },
    async list(req, res) {
      res.json({
        data: await userService.list(
          schemas.parsePage(schemas.directory, req.query),
          req.user.id,
        ),
      });
    },
    async suggestions(req, res) {
      const { limit } = z
        .object({ limit: z.coerce.number().int().min(1).max(20).default(5) })
        .strict()
        .parse(req.query);
      res.json({ data: await followService.suggestions(req.user.id, limit) });
    },
    async saveAvatar(req, res) {
      res.json({ data: await userService.saveAvatar(req.user.id, req.file) });
    },
    async avatar(req, res) {
      res
        .type("webp")
        .send(await userService.avatar(schemas.uuid.parse(req.params.userId)));
    },
  };
}

module.exports = { createUserController };

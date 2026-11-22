const { AppError } = require("../lib/errors");

const cookieName = "instarjify.sid";

function sessionToken(req) {
  return req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
}

function cookieOptions(config) {
  return {
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: "strict",
    path: "/api/v1",
  };
}

function setSession(res, token, config) {
  res.cookie(cookieName, token, {
    ...cookieOptions(config),
    maxAge: config.sessionTtlSeconds * 1000,
  });
}

function clearSession(res, config) {
  res.clearCookie(cookieName, cookieOptions(config));
}

function requireAuth(authService) {
  return async (req, _res, next) => {
    req.user = await authService.authenticate(sessionToken(req));
    if (!req.user)
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue");
    next();
  };
}

function requireOrigin(config) {
  return (req, _res, next) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("origin") !== config.appOrigin
    ) {
      throw new AppError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "State-changing requests must come from the configured application origin",
      );
    }
    next();
  };
}

module.exports = {
  cookieName,
  sessionToken,
  setSession,
  clearSession,
  requireAuth,
  requireOrigin,
};

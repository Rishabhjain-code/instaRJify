const { ZodError } = require("zod");
const { MulterError } = require("multer");
const { AppError } = require("../lib/errors");

function errorHandler(logger) {
  return (error, req, res, _next) => {
    let problem = error;
    let fields;
    if (error instanceof ZodError) {
      problem = new AppError(400, "VALIDATION_ERROR", "Check the submitted fields");
      fields = error.issues.map((issue) => ({
        field: issue.path.join(".") || "request",
        message: issue.message,
      }));
    } else if (error instanceof MulterError) {
      problem = new AppError(
        error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
        error.code,
        error.code === "LIMIT_FILE_SIZE"
          ? "Images must be smaller than 5 MB"
          : "Invalid image upload",
      );
    } else if (error.type === "entity.parse.failed") {
      problem = new AppError(400, "INVALID_JSON", "The request body must be valid JSON");
    } else if (error.type === "entity.too.large") {
      problem = new AppError(413, "BODY_TOO_LARGE", "The request body is too large");
    } else if (error.code === "ER_DUP_ENTRY") {
      problem = new AppError(
        409,
        "RESOURCE_CONFLICT",
        "That email or handle is already registered",
      );
    } else if (
      ["ER_NO_REFERENCED_ROW_2", "ER_ROW_IS_REFERENCED_2"].includes(error.code)
    ) {
      problem = new AppError(
        409,
        "RESOURCE_CHANGED",
        "The related resource changed; refresh and try again",
      );
    } else if (["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(error.code)) {
      res.set("Retry-After", "1");
      problem = new AppError(
        503,
        "RETRY_TRANSACTION",
        "The resource is busy; retry the request",
      );
    }
    if (!(problem instanceof AppError)) {
      logger.error(
        { requestId: req.id, errorType: error.name, errorCode: error.code },
        "Unhandled request error",
      );
      problem = new AppError(500, "INTERNAL_ERROR", "The request could not be completed");
    }
    res.status(problem.status).json({
      error: {
        code: problem.code,
        message: problem.message,
        ...(fields && { fields }),
        requestId: req.id,
      },
    });
  };
}

module.exports = { errorHandler };

const { AppError } = require("../lib/errors");

function createUploadHandler(receive) {
  let active = 0;
  return function withUpload(handler) {
    return async (req, res, next) => {
      const multipart = Boolean(req.is("multipart/form-data"));
      if (multipart && active >= 2) {
        res.set("Retry-After", "1");
        throw new AppError(503, "UPLOAD_BUSY", "Image processing is busy; retry shortly");
      }
      if (multipart) active++;
      try {
        await new Promise((resolve, reject) => {
          const abort = () =>
            reject(new AppError(400, "UPLOAD_ABORTED", "The upload was interrupted"));
          if (req.aborted) return abort();
          req.once("aborted", abort);
          receive(req, res, (error) => {
            req.off("aborted", abort);
            if (error) reject(error);
            else resolve();
          });
        });
        await handler(req, res, next);
      } finally {
        if (multipart) active--;
      }
    };
  };
}

module.exports = { createUploadHandler };

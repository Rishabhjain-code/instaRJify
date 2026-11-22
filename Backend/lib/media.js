const sharp = require("sharp");
const { AppError } = require("./errors");

async function prepareImage(file) {
  if (!file) return null;
  const formats = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[file.mimetype])
    throw new AppError(415, "INVALID_IMAGE", "Upload a JPEG, PNG, or WebP image");
  let result;
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 20000000,
      animated: false,
      failOn: "error",
    });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.mimetype] || (metadata.pages || 1) > 1)
      throw new Error("Unsupported image");
    result = await image
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    throw new AppError(415, "INVALID_IMAGE", "The image could not be decoded safely");
  }
  if (result.length > 2 * 1024 * 1024)
    throw new AppError(
      413,
      "IMAGE_TOO_LARGE",
      "The processed image must be smaller than 2 MB",
    );
  return result;
}

module.exports = { prepareImage };

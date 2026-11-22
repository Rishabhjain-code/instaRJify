const { z } = require("zod");
const { AppError } = require("./errors");

const timestamp = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/)
  .refine((value) => {
    const date = new Date(value.replace(" ", "T") + "Z");
    return (
      Number(value.slice(0, 4)) >= 1000 &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 19) === value.slice(0, 19).replace(" ", "T")
    );
  });
const cursorSchema = z.object({ createdAt: timestamp, id: z.uuid() }).strict();

function decodeCursor(value) {
  if (!value) return null;
  try {
    if (value.length > 256 || !/^[a-zA-Z0-9_-]+$/.test(value))
      throw new Error("Invalid encoding");
    return cursorSchema.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
  } catch {
    throw new AppError(400, "INVALID_CURSOR", "The pagination cursor is invalid");
  }
}

function pageOf(rows, limit) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit
        ? Buffer.from(
            JSON.stringify({ createdAt: last.createdAt, id: last.id }),
          ).toString("base64url")
        : null,
  };
}

module.exports = { decodeCursor, pageOf };

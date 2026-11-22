const { z } = require("zod");
const { decodeCursor } = require("../lib/pagination");

const purpose = z.enum(["learning", "fitness", "creative", "mindful"]);
const password = z.string().min(12, "Use at least 12 characters").max(128);
const handle = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9][a-z0-9_.]*$/, "Use letters, numbers, underscores, or periods");
const email = z.string().trim().toLowerCase().email().max(254);
const profile = {
  name: z.string().trim().min(1).max(80),
  handle,
  bio: z.string().trim().max(320),
  isPublic: z.boolean(),
};
const registration = z
  .object({
    name: profile.name,
    handle,
    email,
    password,
    bio: profile.bio.default(""),
    isPublic: profile.isPublic.default(true),
  })
  .strict();
const login = z.object({ email, password: z.string().min(1).max(128) }).strict();
const updateProfile = z
  .object(profile)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one profile field");
const post = z.object({ caption: z.string().trim().min(1).max(2200), purpose }).strict();
const pagination = {
  limit: z.coerce.number().int().min(1).max(50).default(10),
  cursor: z.string().min(1).max(256).optional(),
};
const page = z.object(pagination).strict();
const feed = z
  .object({
    ...pagination,
    scope: z.enum(["following", "discover", "mine"]).default("following"),
    purpose: purpose.optional(),
  })
  .strict();
const directory = z
  .object({
    ...pagination,
    query: z
      .string()
      .trim()
      .toLowerCase()
      .max(30)
      .regex(/^[a-z0-9_.]*$/)
      .default(""),
  })
  .strict();

function parsePage(schema, query) {
  const parsed = schema.parse(query);
  return { ...parsed, cursor: decodeCursor(parsed.cursor) };
}

module.exports = {
  registration,
  login,
  updateProfile,
  post,
  page,
  feed,
  directory,
  parsePage,
  uuid: z.uuid(),
  password,
};

const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const { readConfig } = require("../config");
const { createPool } = require("../db/pool");
const { transaction } = require("../db/pool");
const { hashPassword } = require("../lib/passwords");
const users = require("../repositories/users");
const posts = require("../repositories/posts");
const { createUserService } = require("../services/userService");
const { createPostService } = require("../services/postService");
const { createFollowService } = require("../services/followService");

const creators = [
  {
    name: "Avery Morgan",
    handle: "avery.makes",
    email: "avery@example.test",
    bio: "Learning in public. Small projects, thoughtful questions, and a little progress every day.",
    isPublic: true,
  },
  {
    name: "Jordan Lee",
    handle: "jordan.moves",
    email: "jordan@example.test",
    bio: "Moving a little more. Making fitness a habit, not a finish line.",
    isPublic: true,
  },
  {
    name: "Rowan Brooks",
    handle: "rowan.creates",
    email: "rowan@example.test",
    bio: "A sketchbook, an open mind, and room for experiments.",
    isPublic: true,
  },
  {
    name: "Sam Rivera",
    handle: "sam.pauses",
    email: "sam@example.test",
    bio: "A quieter corner for the things that matter.",
    isPublic: false,
  },
];
const notes = [
  {
    author: 0,
    purpose: "learning",
    caption:
      "One good question can change an afternoon. Today: what is the smallest version of this idea that could teach me something?",
    colors: ["#e6dff3", "#b3a1ca", "#f6efe5"],
  },
  {
    author: 1,
    purpose: "fitness",
    caption:
      "A walk counts. A stretch counts. Starting again counts. Building a habit is mostly about making it easy to show up tomorrow.",
    colors: ["#dfeae2", "#8eae99", "#eee9d9"],
  },
  {
    author: 0,
    purpose: "creative",
    caption:
      "Leaving a little space in the day for something without a deadline. An unfinished sketch is still time well spent.",
    colors: ["#f0dfd4", "#c3977c", "#e4d8c6"],
  },
  {
    author: 2,
    purpose: "creative",
    caption:
      "A few shapes, three colors, and no plan. Sometimes the useful part of making something is not knowing where it will end.",
    colors: ["#e5e5f1", "#a5a2c6", "#e8c9b5"],
  },
  {
    author: 1,
    purpose: "mindful",
    caption:
      "Took the long way home without headphones. A small reminder that not every moment needs to be filled.",
    colors: null,
  },
  {
    author: 3,
    purpose: "mindful",
    caption:
      "A private note for a smaller circle: this week, choosing a slower start and a little more room to breathe.",
    colors: null,
  },
];

async function illustration(colors) {
  const [background, foreground, accent] = colors;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="600" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="${background}"/><circle cx="820" cy="100" r="210" fill="${accent}"/><circle cx="130" cy="600" r="260" fill="${accent}"/><rect x="405" y="110" width="190" height="390" rx="95" fill="${foreground}"/><path d="M220 500V330a92 92 0 0 1 184 0v170" fill="${accent}"/><path d="M596 500V360a92 92 0 0 1 184 0v140" fill="${foreground}" opacity=".55"/><path d="M150 500h700" stroke="${foreground}" stroke-width="2" opacity=".3"/><circle cx="500" cy="225" r="41" fill="${background}" opacity=".75"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function seed() {
  const config = readConfig();
  if (config.env === "production")
    throw new Error("Demo seeding is disabled in production");
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12 || password === "REPLACE_ME")
    throw new Error("Set a local DEMO_PASSWORD with at least 12 characters in .env");
  const pool = createPool(config.databaseUrl);
  try {
    const passwordHash = await hashPassword(password);
    const accounts = [];
    for (const creator of creators) {
      const existing = await users.findByEmail(pool, creator.email);
      if (existing) {
        accounts.push(existing);
        continue;
      }
      const id = randomUUID();
      await transaction(pool, (db) => users.insert(db, { ...creator, id, passwordHash }));
      accounts.push({ id });
    }
    const userService = createUserService(pool);
    const postService = createPostService(pool, userService);
    const followService = createFollowService(pool, userService);
    for (const [index, note] of notes.entries()) {
      const key = `b0d70000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
      const authorId = accounts[note.author].id;
      if (await posts.findRequest(pool, authorId, key)) continue;
      const file = note.colors
        ? { buffer: await illustration(note.colors), mimetype: "image/png" }
        : null;
      await postService.create(
        authorId,
        { caption: note.caption, purpose: note.purpose },
        file,
        key,
      );
    }
    await followService.follow(accounts[0].id, accounts[1].id);
    await followService.follow(accounts[1].id, accounts[2].id);
    await followService.follow(accounts[0].id, accounts[3].id);
    console.log(
      "Created synthetic demo accounts: avery@example.test, jordan@example.test, rowan@example.test, sam@example.test.",
    );
    console.log(
      "Sign in using DEMO_PASSWORD from your ignored .env file. Existing profiles and posts were not overwritten.",
    );
  } finally {
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(`Seed failed: ${error.code || error.message}`);
  process.exitCode = 1;
});

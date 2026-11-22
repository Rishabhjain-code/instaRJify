export const storageKey = "instarjify:pages-demo:v1";
export const purposes = [
  { id: "learning", label: "Learning", color: "#a69bdb" },
  { id: "fitness", label: "Fitness", color: "#8fbdab" },
  { id: "creative", label: "Creative", color: "#d2a78e" },
  { id: "mindful", label: "Mindful", color: "#91b5d3" },
];
export const creators = [
  {
    id: "avery",
    name: "Avery Morgan",
    handle: "avery.makes",
    bio: "Learning in public, one small project at a time.",
    initials: "AM",
    color: "#a69bdb",
  },
  {
    id: "jordan",
    name: "Jordan Lee",
    handle: "jordan.moves",
    bio: "Building habits, not chasing finish lines.",
    initials: "JL",
    color: "#8fbdab",
  },
  {
    id: "rowan",
    name: "Rowan Brooks",
    handle: "rowan.creates",
    bio: "An open sketchbook and room for experiments.",
    initials: "RB",
    color: "#d2a78e",
  },
];
export const visitor = {
  id: "visitor",
  name: "You",
  handle: "demo.visitor",
  initials: "YO",
  color: "#3794ff",
};
export const samplePosts = [
  {
    id: "sample-1",
    authorId: "avery",
    purpose: "learning",
    caption:
      "One good question can change an afternoon. Today: what is the smallest version of this idea that could teach me something?",
    art: true,
  },
  {
    id: "sample-2",
    authorId: "jordan",
    purpose: "fitness",
    caption:
      "A walk counts. A stretch counts. Starting again counts. Building a habit is mostly about making it easy to show up tomorrow.",
    art: true,
  },
  {
    id: "sample-3",
    authorId: "rowan",
    purpose: "creative",
    caption:
      "A few shapes, three colors, and no plan. Sometimes the useful part of making something is not knowing where it will end.",
    art: true,
  },
  {
    id: "sample-4",
    authorId: "jordan",
    purpose: "mindful",
    caption:
      "Took the long way home without headphones. A small reminder that not every moment needs to be filled.",
  },
  {
    id: "sample-5",
    authorId: "avery",
    purpose: "learning",
    caption:
      "Today I traced one request all the way from a button to a database transaction. Understanding the boundaries made the code feel a lot smaller.",
  },
  {
    id: "sample-6",
    authorId: "rowan",
    purpose: "creative",
    caption:
      "Leaving a little space in the day for something without a deadline. An unfinished sketch is still time well spent.",
  },
];

export function emptyState() {
  return { posts: [], following: ["jordan"] };
}

export function readState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return { state: emptyState(), warning: "" };
    const state = JSON.parse(raw);
    if (
      !state ||
      !Array.isArray(state.posts) ||
      state.posts.length > 25 ||
      !Array.isArray(state.following) ||
      state.following.length > creators.length ||
      !state.following.every((id) => creators.some((creator) => creator.id === id)) ||
      new Set(state.following).size !== state.following.length ||
      !state.posts.every(
        (post) =>
          post &&
          typeof post.id === "string" &&
          /^local-[a-f0-9-]{36}$/.test(post.id) &&
          post.authorId === "visitor" &&
          typeof post.caption === "string" &&
          post.caption.trim().length > 0 &&
          post.caption.length <= 1000 &&
          purposes.some((purpose) => purpose.id === post.purpose),
      ) ||
      new Set(state.posts.map((post) => post.id)).size !== state.posts.length
    )
      throw new Error("Invalid saved demo data");
    return {
      state: {
        posts: state.posts.map(({ id, caption, purpose }) => ({
          id,
          caption,
          purpose,
          authorId: "visitor",
        })),
        following: state.following,
      },
      warning: "",
    };
  } catch {
    return {
      state: emptyState(),
      warning:
        "Saved demo data could not be loaded. Sample data is shown instead. Browser storage may be unavailable; please do not rely on this demo to keep anything important.",
    };
  }
}

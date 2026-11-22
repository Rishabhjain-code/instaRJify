const { AppError } = require("../lib/errors");

const columns = `u.id, u.handle, u.name, u.bio, u.is_public AS isPublic,
  u.avatar_version AS avatarVersion,
  DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s.%f') AS createdAt`;

function userDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio,
    isPublic: Boolean(row.isPublic),
    hasAvatar: row.avatarVersion > 0,
    avatarVersion: row.avatarVersion,
    createdAt: row.createdAt,
    ...(row.relationship !== undefined && { relationship: row.relationship }),
    ...(row.mutualCount !== undefined && { mutualCount: Number(row.mutualCount) }),
    ...(row.postsCount !== undefined && {
      postsCount: Number(row.postsCount),
      followersCount: Number(row.followersCount),
      followingCount: Number(row.followingCount),
    }),
  };
}

async function findByEmail(db, email) {
  const [[row]] = await db.execute(
    `SELECT ${columns}, u.email, u.password_hash AS passwordHash FROM users u WHERE u.email = ?`,
    [email],
  );
  return row;
}

async function findMe(db, id) {
  const [[row]] = await db.execute(
    `SELECT ${columns}, u.email FROM users u WHERE u.id = ?`,
    [id],
  );
  return row ? { ...userDto(row), email: row.email } : null;
}

async function profile(db, id, viewerId) {
  const [[row]] = await db.execute(
    `SELECT ${columns},
    (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id) AS postsCount,
    (SELECT COUNT(*) FROM follows f WHERE f.following_id = u.id AND f.status = 'accepted') AS followersCount,
    (SELECT COUNT(*) FROM follows f WHERE f.follower_id = u.id AND f.status = 'accepted') AS followingCount,
    CASE WHEN u.id = ? THEN 'self' ELSE COALESCE((SELECT f.status FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id), 'none') END AS relationship
    FROM users u WHERE u.id = ?`,
    [viewerId, viewerId, id],
  );
  return userDto(row);
}

async function insert(db, user) {
  await db.execute(
    "INSERT INTO users (id, email, handle, name, password_hash, bio, is_public) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      user.id,
      user.email,
      user.handle,
      user.name,
      user.passwordHash,
      user.bio || "",
      user.isPublic ?? true,
    ],
  );
}

async function lockUsers(db, ids) {
  const users = new Map();
  // Every graph mutation locks its participants in the same order, including reciprocal follows.
  for (const id of [...new Set(ids)].sort()) {
    const [[row]] = await db.execute(
      "SELECT id, is_public AS isPublic FROM users WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!row) throw new AppError(404, "USER_NOT_FOUND", "The user does not exist");
    users.set(id, { id: row.id, isPublic: Boolean(row.isPublic) });
  }
  return users;
}

async function update(db, id, changes) {
  const allowed = { name: "name", handle: "handle", bio: "bio", isPublic: "is_public" };
  const entries = Object.entries(changes);
  await db.execute(
    `UPDATE users SET ${entries.map(([key]) => `${allowed[key]} = ?`).join(", ")} WHERE id = ?`,
    [...entries.map(([, value]) => value), id],
  );
}

async function list(db, { query, cursor, limit }, viewerId) {
  const conditions = ["u.id <> ?", "u.handle LIKE ? ESCAPE '!'"];
  const values = [viewerId, `${query.replace(/[!_%]/g, "!$&")}%`];
  if (cursor) {
    conditions.push("(u.created_at < ? OR (u.created_at = ? AND u.id < ?))");
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const [rows] = await db.execute(
    `SELECT ${columns},
    COALESCE((SELECT f.status FROM follows f WHERE f.follower_id = ? AND f.following_id = u.id), 'none') AS relationship
    FROM users u WHERE ${conditions.join(" AND ")} ORDER BY u.created_at DESC, u.id DESC LIMIT ?`,
    [viewerId, ...values, limit + 1],
  );
  return rows.map(userDto);
}

async function saveAvatar(db, id, bytes) {
  await db.execute(
    "INSERT INTO user_avatars (user_id, bytes) VALUES (?, ?) ON DUPLICATE KEY UPDATE bytes = ?",
    [id, bytes, bytes],
  );
  await db.execute("UPDATE users SET avatar_version = avatar_version + 1 WHERE id = ?", [
    id,
  ]);
}

async function avatar(db, id) {
  const [[row]] = await db.execute("SELECT bytes FROM user_avatars WHERE user_id = ?", [
    id,
  ]);
  return row?.bytes;
}

module.exports = {
  columns,
  userDto,
  findByEmail,
  findMe,
  profile,
  insert,
  lockUsers,
  update,
  list,
  saveAvatar,
  avatar,
};

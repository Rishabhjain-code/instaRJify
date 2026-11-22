const visibility = `(u.is_public = TRUE OR p.author_id = ? OR EXISTS
  (SELECT 1 FROM follows access WHERE access.follower_id = ? AND access.following_id = p.author_id AND access.status = 'accepted'))`;
const columns = `p.id, p.caption, p.purpose, p.has_image AS hasImage,
  DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s.%f') AS createdAt,
  DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s.%f') AS updatedAt,
  u.id AS authorId, u.name AS authorName, u.handle AS authorHandle,
  u.is_public AS authorIsPublic, u.avatar_version AS authorAvatarVersion`;

function postDto(row, viewerId) {
  if (!row) return null;
  return {
    id: row.id,
    caption: row.caption,
    purpose: row.purpose,
    hasImage: Boolean(row.hasImage),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    isOwner: row.authorId === viewerId,
    author: {
      id: row.authorId,
      name: row.authorName,
      handle: row.authorHandle,
      isPublic: Boolean(row.authorIsPublic),
      hasAvatar: row.authorAvatarVersion > 0,
      avatarVersion: row.authorAvatarVersion,
    },
  };
}

async function list(db, viewerId, { scope, purpose, cursor, limit, authorId }) {
  const conditions = [visibility];
  const values = [viewerId, viewerId];
  if (authorId) {
    conditions.push("p.author_id = ?");
    values.push(authorId);
  } else if (scope === "mine") {
    conditions.push("p.author_id = ?");
    values.push(viewerId);
  } else if (scope === "discover") conditions.push("u.is_public = TRUE");
  else {
    conditions.push(
      "(p.author_id = ? OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ? AND f.following_id = p.author_id AND f.status = 'accepted'))",
    );
    values.push(viewerId, viewerId);
  }
  if (purpose) {
    conditions.push("p.purpose = ?");
    values.push(purpose);
  }
  if (cursor) {
    conditions.push("(p.created_at < ? OR (p.created_at = ? AND p.id < ?))");
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const [rows] = await db.execute(
    `SELECT ${columns} FROM posts p JOIN users u ON u.id = p.author_id WHERE ${conditions.join(" AND ")} ORDER BY p.created_at DESC, p.id DESC LIMIT ?`,
    [...values, limit + 1],
  );
  return rows.map((row) => postDto(row, viewerId));
}

async function find(db, id, viewerId) {
  const [[row]] = await db.execute(
    `SELECT ${columns} FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = ? AND ${visibility}`,
    [id, viewerId, viewerId],
  );
  return postDto(row, viewerId);
}

async function findOwned(db, id, authorId) {
  const [[row]] = await db.execute(
    "SELECT id FROM posts WHERE id = ? AND author_id = ? FOR UPDATE",
    [id, authorId],
  );
  return row;
}

async function findRequest(db, userId, key) {
  const [[row]] = await db.execute(
    "SELECT request_hash AS requestHash, post_id AS postId FROM post_requests WHERE user_id = ? AND request_key = ?",
    [userId, key],
  );
  return row;
}

async function insert(db, post, bytes, key, requestHash) {
  await db.execute(
    "INSERT INTO posts (id, author_id, caption, purpose, has_image) VALUES (?, ?, ?, ?, ?)",
    [post.id, post.authorId, post.caption, post.purpose, Boolean(bytes)],
  );
  if (bytes)
    await db.execute("INSERT INTO post_images (post_id, bytes) VALUES (?, ?)", [
      post.id,
      bytes,
    ]);
  await db.execute(
    "INSERT INTO post_requests (user_id, request_key, request_hash, post_id) VALUES (?, ?, ?, ?)",
    [post.authorId, key, requestHash, post.id],
  );
}

async function update(db, id, authorId, caption, purpose) {
  await db.execute(
    "UPDATE posts SET caption = ?, purpose = ?, updated_at = UTC_TIMESTAMP(6) WHERE id = ? AND author_id = ?",
    [caption, purpose, id, authorId],
  );
}

async function remove(db, id, authorId) {
  const [result] = await db.execute("DELETE FROM posts WHERE id = ? AND author_id = ?", [
    id,
    authorId,
  ]);
  return result.affectedRows > 0;
}

async function image(db, id, viewerId) {
  const [[row]] = await db.execute(
    `SELECT media.bytes FROM post_images media JOIN posts p ON p.id = media.post_id JOIN users u ON u.id = p.author_id WHERE p.id = ? AND ${visibility}`,
    [id, viewerId, viewerId],
  );
  return row?.bytes;
}

module.exports = { list, find, findOwned, findRequest, insert, update, remove, image };

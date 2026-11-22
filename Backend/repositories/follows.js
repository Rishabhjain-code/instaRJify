const { columns, userDto } = require("./users");

async function put(db, followerId, followingId, status) {
  await db.execute(
    "INSERT INTO follows (follower_id, following_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE follower_id = ?",
    [followerId, followingId, status, followerId],
  );
  const [[row]] = await db.execute(
    "SELECT status FROM follows WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return row.status;
}

async function accept(db, followerId, followingId) {
  const [result] = await db.execute(
    "UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND following_id = ?",
    [followerId, followingId],
  );
  return result.affectedRows > 0;
}

async function acceptPending(db, followingId) {
  await db.execute(
    "UPDATE follows SET status = 'accepted' WHERE following_id = ? AND status = 'pending'",
    [followingId],
  );
}

async function remove(db, followerId, followingId) {
  await db.execute("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [
    followerId,
    followingId,
  ]);
}

async function list(db, userId, viewerId, kind, { cursor, limit }) {
  const incoming = kind !== "following";
  const status = kind === "requests" ? "pending" : "accepted";
  const conditions = [
    `f.${incoming ? "following_id" : "follower_id"} = ?`,
    "f.status = ?",
    "(owner.is_public = TRUE OR owner.id = ? OR EXISTS (SELECT 1 FROM follows permission WHERE permission.follower_id = ? AND permission.following_id = owner.id AND permission.status = 'accepted'))",
  ];
  const values = [userId, status, viewerId, viewerId];
  if (cursor) {
    conditions.push("(u.created_at < ? OR (u.created_at = ? AND u.id < ?))");
    values.push(cursor.createdAt, cursor.createdAt, cursor.id);
  }
  const [rows] = await db.execute(
    `SELECT ${columns} FROM follows f JOIN users u ON u.id = f.${incoming ? "follower_id" : "following_id"} JOIN users owner ON owner.id = ? WHERE ${conditions.join(" AND ")} ORDER BY u.created_at DESC, u.id DESC LIMIT ?`,
    [userId, ...values, limit + 1],
  );
  return rows.map(userDto);
}

async function suggestions(db, userId, limit) {
  const [rows] = await db.execute(
    `SELECT ${columns}, COUNT(DISTINCT shared.following_id) AS mutualCount, 'none' AS relationship
    FROM users u
    LEFT JOIN follows network ON network.following_id = u.id AND network.status = 'accepted'
    LEFT JOIN follows shared ON shared.follower_id = ? AND shared.following_id = network.follower_id AND shared.status = 'accepted'
    WHERE u.id <> ? AND u.is_public = TRUE
      AND NOT EXISTS (SELECT 1 FROM follows existing WHERE existing.follower_id = ? AND existing.following_id = u.id)
    GROUP BY u.id ORDER BY mutualCount DESC, u.created_at DESC, u.id DESC LIMIT ?`,
    [userId, userId, userId, limit],
  );
  return rows.map(userDto);
}

module.exports = { put, accept, acceptPending, remove, list, suggestions };

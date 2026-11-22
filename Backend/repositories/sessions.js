const { columns, userDto } = require("./users");

async function insert(db, userId, tokenHash, ttlSeconds) {
  await db.execute(
    "DELETE FROM sessions WHERE user_id = ? AND expires_at <= UTC_TIMESTAMP(6)",
    [userId],
  );
  await db.execute(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ? SECOND))",
    [tokenHash, userId, ttlSeconds],
  );
}

async function find(db, tokenHash) {
  const [[row]] = await db.execute(
    `SELECT ${columns}, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP(6)`,
    [tokenHash],
  );
  return row ? { ...userDto(row), email: row.email } : null;
}

async function remove(db, tokenHash) {
  await db.execute("DELETE FROM sessions WHERE token_hash = ?", [tokenHash]);
}

module.exports = { insert, find, remove };

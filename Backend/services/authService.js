const { createHash, randomBytes, randomUUID } = require("node:crypto");
const users = require("../repositories/users");
const sessions = require("../repositories/sessions");
const { transaction } = require("../db/pool");
const { hashPassword, verifyPassword } = require("../lib/passwords");
const { AppError } = require("../lib/errors");

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

function createAuthService(pool, config) {
  const dummyHash = hashPassword(randomBytes(32).toString("hex"));

  async function createSession(db, userId, previousToken) {
    const token = randomBytes(32).toString("base64url");
    if (previousToken) await sessions.remove(db, tokenHash(previousToken));
    await sessions.insert(db, userId, tokenHash(token), config.sessionTtlSeconds);
    return { token, user: await users.findMe(db, userId) };
  }

  return {
    async register(input, previousToken) {
      const passwordHash = await hashPassword(input.password);
      return transaction(pool, async (db) => {
        const id = randomUUID();
        await users.insert(db, { ...input, id, passwordHash });
        return createSession(db, id, previousToken);
      });
    },
    async login(input, previousToken) {
      const account = await users.findByEmail(pool, input.email);
      const valid = await verifyPassword(
        input.password,
        account?.passwordHash || (await dummyHash),
      );
      if (!account || !valid)
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "The email or password is incorrect",
        );
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [account.id]);
        return createSession(db, account.id, previousToken);
      });
    },
    async authenticate(token) {
      if (!token || !/^[a-zA-Z0-9_-]{43}$/.test(token)) return null;
      return sessions.find(pool, tokenHash(token));
    },
    async logout(token) {
      if (token) await sessions.remove(pool, tokenHash(token));
    },
    async deleteAccount(userId, password) {
      return transaction(pool, async (db) => {
        await users.lockUsers(db, [userId]);
        const [[account]] = await db.execute(
          "SELECT password_hash AS passwordHash FROM users WHERE id = ?",
          [userId],
        );
        if (!(await verifyPassword(password, account.passwordHash)))
          throw new AppError(401, "INVALID_CREDENTIALS", "The password is incorrect");
        await db.execute("DELETE FROM users WHERE id = ?", [userId]);
      });
    },
  };
}

module.exports = { createAuthService, tokenHash };

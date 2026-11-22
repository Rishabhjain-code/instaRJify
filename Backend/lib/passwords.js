const { randomBytes, scrypt: scryptCallback, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(scryptCallback);

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${key.toString("hex")}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, salt, hash] = encoded.split("$");
  if (
    algorithm !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(salt) ||
    !/^[a-f0-9]{128}$/.test(hash)
  ) {
    throw new Error("Invalid stored password hash");
  }
  const actual = await scrypt(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, "hex"), actual);
}

module.exports = { hashPassword, verifyPassword };

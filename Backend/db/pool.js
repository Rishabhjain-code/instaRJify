const mysql = require("mysql2/promise");

function createPool(databaseUrl) {
  return mysql.createPool({
    uri: databaseUrl,
    connectionLimit: 10,
    maxIdle: 5,
    idleTimeout: 60000,
    waitForConnections: true,
    queueLimit: 100,
    connectTimeout: 10000,
    timezone: "Z",
    dateStrings: true,
    charset: "utf8mb4",
    multipleStatements: false,
    maxPreparedStatements: 100,
  });
}

async function transaction(pool, operation) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createPool, transaction };

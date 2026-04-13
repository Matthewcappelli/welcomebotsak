const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS guilds (
      guild_id TEXT PRIMARY KEY,
      channel_id TEXT,
      title TEXT,
      description TEXT,
      color TEXT
    );
  `);
  console.log("Database ready");
}

initDB();

module.exports = pool;
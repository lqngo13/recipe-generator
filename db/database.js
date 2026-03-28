require('dotenv').config();
require('dns').setDefaultResultOrder('ipv4first');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
});

// Create tables on startup (safe to run every time — IF NOT EXISTS)
const _ready = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pantry (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      ingredient TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS favourites (
      id             SERIAL PRIMARY KEY,
      user_id        INTEGER NOT NULL REFERENCES users(id),
      recipe_name    TEXT NOT NULL,
      description    TEXT,
      cuisine        TEXT,
      estimated_time INTEGER,
      ingredients    TEXT,
      instructions   TEXT,
      saved_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

pool._ready = _ready;
module.exports = pool;

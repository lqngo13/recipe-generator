const Database = require('better-sqlite3');
const path = require('path');

// Open the database file (creates it if it doesn't exist)
const db = new Database(path.join(__dirname, 'app.db'));

// WAL mode improves read/write performance
db.pragma('journal_mode = WAL');

// -------------------------------------------------------
// Create tables (only runs if the table doesn't exist yet)
// -------------------------------------------------------

// USERS — stores login credentials
// COLLATE NOCASE means username lookups are case-insensitive (liemn = LiemN = LIEMN)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password   TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// PANTRY — one row per ingredient per user
// When a user saves their pantry, we delete their old rows and insert new ones
db.exec(`
  CREATE TABLE IF NOT EXISTS pantry (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    ingredient TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

// FAVOURITES — full recipe data stored per user
// Ingredients and instructions are stored as JSON strings because they're nested data
db.exec(`
  CREATE TABLE IF NOT EXISTS favourites (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    recipe_name    TEXT NOT NULL,
    description    TEXT,
    cuisine        TEXT,
    estimated_time INTEGER,
    ingredients    TEXT,    -- JSON string: { pantry: [...], fresh: [...] }
    instructions   TEXT,    -- JSON string: ["Step 1: ...", "Step 2: ..."]
    saved_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
`);

module.exports = db;

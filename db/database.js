const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'app.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// TODO: create your tables here
// Example:
// db.exec(`
//   CREATE TABLE IF NOT EXISTS users (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT NOT NULL,
//     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//   )
// `);

module.exports = db;

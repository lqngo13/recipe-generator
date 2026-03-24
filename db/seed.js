// -------------------------------------------------------
// Seed script — run once to create the two user accounts
// Usage: node db/seed.js
// -------------------------------------------------------

const bcrypt = require('bcryptjs');
const db = require('./database');

const SALT_ROUNDS = 10; // Higher = more secure but slower. 10 is the standard.

const users = [
  { username: 'LiemN', password: 'liemishandsome' },
  { username: 'Teep',  password: 'liemishandsome' },
];

console.log('Seeding users...\n');

for (const user of users) {
  // Check if this user already exists so we don't create duplicates
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);

  if (existing) {
    console.log(`  "${user.username}" already exists — skipping.`);
    continue;
  }

  // Hash the password before storing it
  // bcrypt hashing is one-way — the original password can never be recovered from the hash
  const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);

  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(user.username, hashedPassword);
  console.log(`  Created user: ${user.username}`);
}

console.log('\nDone. You can now start the server with: npm run dev');

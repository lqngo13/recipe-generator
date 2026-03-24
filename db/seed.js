// -------------------------------------------------------
// Seed script — safe to run multiple times
// Usage: node db/seed.js
// -------------------------------------------------------

const bcrypt = require('bcryptjs');
const db     = require('./database');

const SALT_ROUNDS = 10;

const users = [
  { username: 'LiemN', password: 'liemishandsome' },
  { username: 'Teep',  password: 'liemishandsome' },
];

// Default pantry items added to every new user's pantry (if their pantry is empty)
const DEFAULT_PANTRY = [
  'Olive oil', 'Vegetable oil', 'Sesame oil',
  'Soy sauce', 'Fish sauce', 'White vinegar',
  'Salt', 'Black pepper', 'Garlic powder', 'Onion powder',
  'Paprika', 'Cumin', 'Chili flakes', 'Oregano',
  'Cinnamon', 'Turmeric',
  'White rice', 'Pasta', 'Bread', 'Cornstarch', 'Plain flour',
  'Chicken stock',
  'Garlic', 'Onion', 'Ginger',
  'Ketchup', 'Mustard', 'Oyster sauce', 'Hoisin sauce',
  'Worcestershire sauce', 'Honey', 'Sugar', 'Brown sugar',
  'Butter', 'Eggs',
];

console.log('Seeding users...\n');

for (const user of users) {
  // Create user if they don't exist yet
  let userId;
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);

  if (existing) {
    console.log(`  "${user.username}" already exists — skipping account creation.`);
    userId = existing.id;
  } else {
    const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);
    const result = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(user.username, hashedPassword);
    userId = result.lastInsertRowid;
    console.log(`  Created user: ${user.username}`);
  }

  // Add default pantry items only if this user's pantry is currently empty
  const pantryCount = db.prepare('SELECT COUNT(*) as count FROM pantry WHERE user_id = ?').get(userId).count;

  if (pantryCount === 0) {
    const insert = db.prepare('INSERT INTO pantry (user_id, ingredient) VALUES (?, ?)');
    for (const item of DEFAULT_PANTRY) {
      insert.run(userId, item);
    }
    console.log(`  Added ${DEFAULT_PANTRY.length} default pantry items for ${user.username}.`);
  } else {
    console.log(`  "${user.username}" already has pantry items — skipping defaults.`);
  }
}

console.log('\nDone. You can now start the server with: npm run dev');

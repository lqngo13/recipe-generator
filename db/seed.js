// -------------------------------------------------------
// Seed script — safe to run multiple times
// Usage: node db/seed.js
// -------------------------------------------------------

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const pool   = require('./database');

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

async function seed() {
  // Wait for the DB init (table creation) to finish before seeding
  await pool._ready;

  console.log('Seeding users...\n');

  for (const user of users) {
    let userId;

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [user.username]
    );

    if (rows[0]) {
      console.log(`  "${user.username}" already exists — skipping account creation.`);
      userId = rows[0].id;
    } else {
      const hashedPassword = bcrypt.hashSync(user.password, SALT_ROUNDS);
      const { rows: inserted } = await pool.query(
        'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id',
        [user.username, hashedPassword]
      );
      userId = inserted[0].id;
      console.log(`  Created user: ${user.username}`);
    }

    // Add default pantry items only if this user's pantry is currently empty
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS count FROM pantry WHERE user_id = $1',
      [userId]
    );
    const pantryCount = parseInt(countRows[0].count, 10);

    if (pantryCount === 0) {
      await Promise.all(
        DEFAULT_PANTRY.map(item =>
          pool.query('INSERT INTO pantry (user_id, ingredient) VALUES ($1, $2)', [userId, item])
        )
      );
      console.log(`  Added ${DEFAULT_PANTRY.length} default pantry items for ${user.username}.`);
    } else {
      console.log(`  "${user.username}" already has pantry items — skipping defaults.`);
    }
  }

  console.log('\nDone. You can now start the server with: npm run dev');
  await pool.end();
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

// -------------------------------------------------------
// Pantry routes: get and save a user's pantry staples
// -------------------------------------------------------

const express     = require('express');
const db          = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// All pantry routes require the user to be logged in
router.use(requireAuth);

// GET /api/pantry
// Returns all pantry items for the logged-in user
router.get('/', (req, res) => {
  const items = db
    .prepare('SELECT id, ingredient FROM pantry WHERE user_id = ? ORDER BY ingredient ASC')
    .all(req.session.userId);

  res.json(items);
});

// POST /api/pantry
// Replaces the user's entire pantry with a new list
// Expects: { ingredients: ["salt", "pepper", "olive oil", ...] }
router.post('/', (req, res) => {
  const { ingredients } = req.body;

  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'ingredients must be an array.' });
  }

  // Delete all existing pantry items for this user, then re-insert the new list.
  // This is simpler than trying to figure out what changed.
  db.prepare('DELETE FROM pantry WHERE user_id = ?').run(req.session.userId);

  const insert = db.prepare('INSERT INTO pantry (user_id, ingredient) VALUES (?, ?)');
  for (const ingredient of ingredients) {
    const trimmed = ingredient.trim();
    if (trimmed) {
      insert.run(req.session.userId, trimmed);
    }
  }

  res.json({ success: true });
});

module.exports = router;

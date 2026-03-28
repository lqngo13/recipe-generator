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
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, ingredient FROM pantry WHERE user_id = $1 ORDER BY ingredient ASC',
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Pantry GET error:', err.message);
    res.status(500).json({ error: 'Failed to load pantry.' });
  }
});

// POST /api/pantry
// Replaces the user's entire pantry with a new list
// Expects: { ingredients: ["salt", "pepper", "olive oil", ...] }
router.post('/', async (req, res) => {
  const { ingredients } = req.body;

  if (!Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'ingredients must be an array.' });
  }

  try {
    // Delete all existing pantry items for this user, then re-insert the new list.
    // This is simpler than trying to figure out what changed.
    await db.query('DELETE FROM pantry WHERE user_id = $1', [req.session.userId]);

    const trimmed = ingredients.map(i => i.trim()).filter(Boolean);
    await Promise.all(
      trimmed.map(ingredient =>
        db.query('INSERT INTO pantry (user_id, ingredient) VALUES ($1, $2)', [req.session.userId, ingredient])
      )
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Pantry POST error:', err.message);
    res.status(500).json({ error: 'Failed to save pantry.' });
  }
});

module.exports = router;

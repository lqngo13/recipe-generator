// -------------------------------------------------------
// Favourites routes: save, list, view, and delete saved recipes
// -------------------------------------------------------

const express     = require('express');
const db          = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

// GET /api/favourites
// Returns all saved recipes for the logged-in user, newest first
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, recipe_name, description, cuisine, estimated_time, ingredients, instructions, saved_at
      FROM favourites
      WHERE user_id = $1
      ORDER BY saved_at DESC
    `, [req.session.userId]);

    // Parse the JSON strings back into actual objects/arrays before sending
    const favourites = rows.map(row => ({
      ...row,
      ingredients:  JSON.parse(row.ingredients  || '{}'),
      instructions: JSON.parse(row.instructions || '[]'),
    }));

    res.json(favourites);
  } catch (err) {
    console.error('Favourites GET error:', err.message);
    res.status(500).json({ error: 'Failed to load favourites.' });
  }
});

// GET /api/favourites/check/:recipeName
// Checks if a specific recipe is already saved by the logged-in user
// Returns { saved: true/false, id: number|null }
router.get('/check/:recipeName', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id FROM favourites WHERE user_id = $1 AND recipe_name = $2',
      [req.session.userId, req.params.recipeName]
    );
    const row = rows[0];
    res.json({ saved: !!row, id: row ? row.id : null });
  } catch (err) {
    console.error('Favourites check error:', err.message);
    res.status(500).json({ error: 'Failed to check favourite.' });
  }
});

// POST /api/favourites
// Saves a recipe to the user's favourites
// Expects the full recipe object in the request body
router.post('/', async (req, res) => {
  const { name, description, cuisine, estimatedTime, ingredients, instructions } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Recipe name is required.' });
  }

  try {
    // Don't save duplicates
    const { rows: existing } = await db.query(
      'SELECT id FROM favourites WHERE user_id = $1 AND recipe_name = $2',
      [req.session.userId, name]
    );

    if (existing[0]) {
      return res.json({ success: true, alreadySaved: true, id: existing[0].id });
    }

    // RETURNING id gives us the new row's id without a second query
    const { rows } = await db.query(`
      INSERT INTO favourites (user_id, recipe_name, description, cuisine, estimated_time, ingredients, instructions)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      req.session.userId,
      name,
      description,
      cuisine,
      estimatedTime,
      JSON.stringify(ingredients  || {}),
      JSON.stringify(instructions || []),
    ]);

    res.json({ success: true, id: rows[0].id });
  } catch (err) {
    console.error('Favourites POST error:', err.message);
    res.status(500).json({ error: 'Failed to save favourite.' });
  }
});

// DELETE /api/favourites/:id
// Removes a saved recipe (only if it belongs to the logged-in user)
router.delete('/:id', async (req, res) => {
  try {
    await db.query(
      'DELETE FROM favourites WHERE id = $1 AND user_id = $2',
      [req.params.id, req.session.userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Favourites DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete favourite.' });
  }
});

module.exports = router;

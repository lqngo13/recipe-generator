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
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, recipe_name, description, cuisine, estimated_time, ingredients, instructions, saved_at
    FROM favourites
    WHERE user_id = ?
    ORDER BY saved_at DESC
  `).all(req.session.userId);

  // Parse the JSON strings back into actual objects/arrays before sending
  const favourites = rows.map(row => ({
    ...row,
    ingredients:  JSON.parse(row.ingredients  || '{}'),
    instructions: JSON.parse(row.instructions || '[]'),
  }));

  res.json(favourites);
});

// GET /api/favourites/check/:recipeName
// Checks if a specific recipe is already saved by the logged-in user
// Returns { saved: true/false, id: number|null }
router.get('/check/:recipeName', (req, res) => {
  const row = db.prepare(
    'SELECT id FROM favourites WHERE user_id = ? AND recipe_name = ?'
  ).get(req.session.userId, req.params.recipeName);

  res.json({ saved: !!row, id: row ? row.id : null });
});

// POST /api/favourites
// Saves a recipe to the user's favourites
// Expects the full recipe object in the request body
router.post('/', (req, res) => {
  const { name, description, cuisine, estimatedTime, ingredients, instructions } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Recipe name is required.' });
  }

  // Don't save duplicates
  const existing = db.prepare(
    'SELECT id FROM favourites WHERE user_id = ? AND recipe_name = ?'
  ).get(req.session.userId, name);

  if (existing) {
    return res.json({ success: true, alreadySaved: true, id: existing.id });
  }

  const result = db.prepare(`
    INSERT INTO favourites (user_id, recipe_name, description, cuisine, estimated_time, ingredients, instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.session.userId,
    name,
    description,
    cuisine,
    estimatedTime,
    JSON.stringify(ingredients  || {}),
    JSON.stringify(instructions || [])
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

// DELETE /api/favourites/:id
// Removes a saved recipe (only if it belongs to the logged-in user)
router.delete('/:id', (req, res) => {
  db.prepare(
    'DELETE FROM favourites WHERE id = ? AND user_id = ?'
  ).run(req.params.id, req.session.userId);

  res.json({ success: true });
});

module.exports = router;

// -------------------------------------------------------
// Recipes route: calls the Gemini AI API to suggest recipes
// -------------------------------------------------------

const express     = require('express');
const db          = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
router.use(requireAuth);

// -------------------------------------------------------
// Cuisine hierarchy
// -------------------------------------------------------
// Defines which cuisines are sub-cuisines and who their parent is.
// To add sub-cuisines for a new parent in V2, just add an entry here.
// e.g. 'Italian': ['Northern Italian', 'Neapolitan', 'Sicilian']
const cuisineTree = {
  'Asian': ['Vietnamese', 'Korean', 'Chinese', 'Japanese'],
};

// Flat list of all known sub-cuisines, derived from the tree above
const allSubCuisines = Object.values(cuisineTree).flat();

// -------------------------------------------------------
// buildCuisineInstruction(cuisines)
// -------------------------------------------------------
// Receives a flat array of all checked cuisine values (parents + subs).
// Rules:
//   - If ANY sub-cuisines are selected → strict: only those exact sub-cuisines
//   - If only parent cuisines selected (e.g. Asian, no subs) → any of that parent type
//   - If "Any" or nothing selected → no restriction
function buildCuisineInstruction(cuisines) {
  const selectedSubs = cuisines.filter(c => allSubCuisines.includes(c));

  if (selectedSubs.length > 0) {
    // Strict mode: user picked specific sub-cuisines — do not expand beyond them
    return `You MUST suggest ONLY recipes from these specific cuisines: ${selectedSubs.join(' and ')}. `
      + `Do NOT suggest any other cuisine even if it belongs to the same broad category. `
      + `For example, if Korean is listed, do NOT suggest Japanese, Chinese, Vietnamese, or any other Asian cuisine not explicitly listed.`;
  }

  if (cuisines.includes('Any') || cuisines.length === 0) {
    return 'You may suggest recipes from any cuisine.';
  }

  // Parent cuisines only (e.g. just "Asian" with no subs = any Asian cuisine is fine)
  const parentCuisines = cuisines.filter(c => !allSubCuisines.includes(c) && c !== 'Any');
  return `Suggest recipes from these cuisines only: ${parentCuisines.join(', ')}.`;
}

// -------------------------------------------------------
// buildTimeInstruction(time, passiveOk)
// -------------------------------------------------------
// Translates the time slider + passive toggle into a clear AI instruction.
function buildTimeInstruction(time, passiveOk) {
  if (passiveOk) {
    return `Active (hands-on) cooking time limit: ${time} minutes. `
      + `Passive steps such as marinating, baking, slow cooking, or resting do NOT count against this limit. `
      + `A recipe with ${time} minutes or less of active prep is acceptable even if it bakes for hours or marinates overnight.`;
  }
  return `Total time limit: ${time} minutes, including all prep, marinating, and cooking. `
    + `The recipe must be fully completable within this total time.`;
}

// -------------------------------------------------------
// JSON extractor
// -------------------------------------------------------
function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

// -------------------------------------------------------
// POST /api/recipes/search
// -------------------------------------------------------
router.post('/search', async (req, res) => {
  const {
    fridgeIngredients,
    time,
    cuisines,
    grain,
    notes,
    passiveOk,
    excludeRecipes
  } = req.body;

  const { rows: pantryRows } = await db.query(
    'SELECT ingredient FROM pantry WHERE user_id = $1',
    [req.session.userId]
  );
  const pantryItems = pantryRows.map(r => r.ingredient);

  const cuisineInstruction = buildCuisineInstruction(cuisines || []);
  const timeInstruction    = buildTimeInstruction(time || 60, !!passiveOk);

  const excludeNote = excludeRecipes && excludeRecipes.length > 0
    ? `\nIMPORTANT: Do NOT suggest any of these recipes — they have already been shown: ${excludeRecipes.join(', ')}.`
    : '';

  const prompt = `You are a helpful recipe assistant. Suggest exactly 5 recipes based on the following inputs.

Fresh ingredients available: ${fridgeIngredients || 'not specified'}
Pantry staples always on hand: ${pantryItems.length > 0 ? pantryItems.join(', ') : 'none listed'}
Time: ${timeInstruction}
Preferred grain: ${grain && grain !== 'No preference' ? grain : 'no preference'}
Additional notes: ${notes || 'none'}

Cuisine instruction: ${cuisineInstruction}
${excludeNote}

Return ONLY a valid JSON array with exactly 5 objects. Do not include any text, explanation, or markdown outside the JSON.

Each object must follow this exact structure:
{
  "name": "Recipe Name",
  "description": "A two-sentence description of the dish.",
  "cuisine": "Cuisine type",
  "estimatedTime": 30,
  "ingredients": {
    "pantry": ["salt", "olive oil", "garlic"],
    "fresh": ["chicken breast", "lemon", "broccoli"]
  },
  "instructions": [
    "Step 1: Do this.",
    "Step 2: Then do this."
  ],
  "sourceUrl": null
}

Rules:
- estimatedTime must be a plain number (minutes) representing total time including passive steps
- pantry array should only contain items from the provided pantry staples list
- fresh array should only contain items from the provided fresh ingredients list
- Keep instructions clear and beginner-friendly
- Each recipe should be genuinely different from the others
- sourceUrl: ONLY include a real URL if this recipe comes from a well-known published source you are certain about (e.g. seriouseats.com, bonappetit.com, allrecipes.com, bbcgoodfood.com). If unsure, set sourceUrl to null. Do not guess or invent URLs.`;

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const apiRes    = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.json();
      throw new Error(JSON.stringify(errBody));
    }

    const apiData      = await apiRes.json();
    const rawText      = apiData.candidates[0].content.parts[0].text;
    const responseText = extractJSON(rawText);
    const recipes      = JSON.parse(responseText);

    res.json({ recipes, pantryItems });

  } catch (error) {
    console.error('Recipe search error:', error.message);
    res.status(500).json({ error: 'Failed to get recipe suggestions. Please try again.' });
  }
});

module.exports = router;

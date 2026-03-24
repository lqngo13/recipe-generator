// -------------------------------------------------------
// Recipes route: calls the Gemini AI API to suggest recipes
// -------------------------------------------------------

const express     = require('express');
const db          = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

// -------------------------------------------------------
// Cuisine instruction builder
// -------------------------------------------------------
// Translates cuisine checkbox selections into a clear AI instruction.
// Sub-cuisines (like Vietnamese) override their parent category (Asian).
// To add more sub-cuisines in V2, just add them to the subCuisines array.
function buildCuisineInstruction(cuisines) {
  // V2: add 'Thai', 'Japanese', 'Korean', 'Chinese' etc. here
  const subCuisines    = ['Vietnamese'];
  const selectedSubs   = cuisines.filter(c => subCuisines.includes(c));

  if (selectedSubs.length > 0) {
    return `You MUST suggest only ${selectedSubs.join(' or ')} recipes. Do not suggest any other cuisine types, including other Asian cuisines.`;
  }
  if (cuisines.includes('Any') || cuisines.length === 0) {
    return 'You may suggest recipes from any cuisine.';
  }
  return `Suggest recipes from these cuisines only: ${cuisines.join(', ')}.`;
}

// -------------------------------------------------------
// JSON extractor
// -------------------------------------------------------
// Gemini sometimes wraps its response in markdown code blocks.
// This strips those out so we can parse the raw JSON.
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
    excludeRecipes
  } = req.body;

  // Fetch this user's saved pantry items from the database
  const pantryRows  = db.prepare('SELECT ingredient FROM pantry WHERE user_id = ?').all(req.session.userId);
  const pantryItems = pantryRows.map(r => r.ingredient);

  const cuisineInstruction = buildCuisineInstruction(cuisines || []);

  const excludeNote = excludeRecipes && excludeRecipes.length > 0
    ? `\nIMPORTANT: Do NOT suggest any of these recipes — they have already been shown: ${excludeRecipes.join(', ')}.`
    : '';

  const prompt = `You are a helpful recipe assistant. Suggest exactly 5 recipes based on the following inputs.

Fresh ingredients available: ${fridgeIngredients || 'not specified'}
Pantry staples always on hand: ${pantryItems.length > 0 ? pantryItems.join(', ') : 'none listed'}
Time available: ${time || 60} minutes (total, including all prep and cooking)
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
- estimatedTime must be a plain number (minutes), fitting within the time available
- pantry array should only contain items from the provided pantry staples list
- fresh array should only contain items from the provided fresh ingredients list
- Keep instructions clear and beginner-friendly
- Each recipe should be genuinely different from the others
- sourceUrl: ONLY include a real URL if this recipe comes from a well-known published source you are certain about (e.g. seriouseats.com, bonappetit.com, allrecipes.com, bbcgoodfood.com). If the recipe is a generic suggestion or you have any doubt the URL exists, set sourceUrl to null. Do not guess or invent URLs.`;

  try {
    // Call the Gemini REST API directly (no SDK)
    // URL is built here (not at startup) so the API key is always read from the loaded .env
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const apiRes = await fetch(geminiUrl, {
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

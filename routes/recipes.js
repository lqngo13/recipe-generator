// -------------------------------------------------------
// Recipes route: calls the Claude AI API to suggest recipes
// -------------------------------------------------------

const express     = require('express');
const Anthropic   = require('@anthropic-ai/sdk');
const db          = require('../db/database');
const requireAuth = require('../middleware/requireAuth');

const router     = express.Router();
const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.use(requireAuth);

// -------------------------------------------------------
// Cuisine instruction builder
// -------------------------------------------------------
// This function translates the user's cuisine checkbox selections into a clear
// instruction that gets added to the AI prompt.
//
// Key rule: sub-cuisines (like Vietnamese) override broader categories (like Asian).
// This structure makes it easy to add Thai, Japanese, Korean, etc. in V2 —
// just add them to the subCuisines array below.
function buildCuisineInstruction(cuisines) {
  // List of specific sub-cuisines that override their parent category
  // V2: add 'Thai', 'Japanese', 'Korean', 'Chinese' etc. here
  const subCuisines = ['Vietnamese'];

  const selectedSubs = cuisines.filter(c => subCuisines.includes(c));

  if (selectedSubs.length > 0) {
    // A sub-cuisine was selected — be strict, don't suggest anything else
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
// Claude sometimes wraps its JSON response in markdown code blocks.
// This function strips those out so we can parse the raw JSON.
function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.trim();
}

// -------------------------------------------------------
// POST /api/recipes/search
// -------------------------------------------------------
// Main endpoint — takes the user's search inputs, fetches their pantry from the DB,
// builds a prompt, calls Claude, and returns 5 recipe suggestions.
router.post('/search', async (req, res) => {
  const {
    fridgeIngredients,  // string: "chicken, lemon, broccoli"
    time,               // number: minutes available
    cuisines,           // array: ["Asian", "Vietnamese"]
    grain,              // string: "Rice" or "No preference"
    notes,              // string: "nothing spicy"
    excludeRecipes      // array: recipe names to exclude (used by "Find More Recipes")
  } = req.body;

  // Fetch this user's saved pantry items from the database
  const pantryRows  = db.prepare('SELECT ingredient FROM pantry WHERE user_id = ?').all(req.session.userId);
  const pantryItems = pantryRows.map(r => r.ingredient);

  const cuisineInstruction = buildCuisineInstruction(cuisines || []);

  // If "Find More" was clicked, tell Claude not to repeat the previous results
  const excludeNote = excludeRecipes && excludeRecipes.length > 0
    ? `\nIMPORTANT: Do NOT suggest any of these recipes — they have already been shown: ${excludeRecipes.join(', ')}.`
    : '';

  // Build the prompt we'll send to Claude
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
  ]
}

Rules:
- estimatedTime must be a plain number (minutes), and must fit within the time available
- pantry array should only contain items from the provided pantry staples list
- fresh array should only contain items from the provided fresh ingredients list
- Keep instructions clear and beginner-friendly — assume the user is not a trained chef
- Each recipe should be genuinely different from the others`;

  try {
    const message = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      messages:   [{ role: 'user', content: prompt }]
    });

    // Extract and parse the JSON from Claude's response
    const responseText = extractJSON(message.content[0].text);
    const recipes      = JSON.parse(responseText);

    // Return both the recipes and the pantry items so the frontend
    // can label ingredients as "pantry" or "fresh" in the full recipe view
    res.json({ recipes, pantryItems });

  } catch (error) {
    console.error('Recipe search error:', error.message);
    res.status(500).json({ error: 'Failed to get recipe suggestions. Please try again.' });
  }
});

module.exports = router;

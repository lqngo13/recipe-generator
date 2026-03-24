// ============================================================
// recipe.js — Full Recipe view
// ============================================================
// Reads the recipe to display from sessionStorage ('viewingRecipe').
// This page is reached from two places:
//   - Results page ("See Full Recipe")
//   - Favourites page (clicking a saved recipe)
// The 'fromFavourites' flag controls where the back button goes.

const content = document.getElementById('recipe-content');

// -------------------------------------------------------
// escapeHtml helper
// -------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------------------------------------------
// renderRecipe(recipe, pantryItems, fromFavourites, favouriteId)
// Builds the full recipe view and injects it into the page.
// -------------------------------------------------------
function renderRecipe(recipe, pantryItems, fromFavourites, favouriteId) {
  const backHref  = fromFavourites ? '/favourites.html' : '/results.html';
  const backLabel = fromFavourites ? '← Back to Favourites' : '← Back to Results';

  // Build the ingredients section, split into Pantry and Fresh groups
  const pantryIngredients = recipe.ingredients?.pantry || [];
  const freshIngredients  = recipe.ingredients?.fresh  || [];

  const pantryHtml = pantryIngredients.length > 0 ? `
    <div class="ingredient-group">
      <div class="ingredient-group-label pantry">🧂 Pantry staples</div>
      <ul class="ingredient-list">
        ${pantryIngredients.map(i => `
          <li>${escapeHtml(i)} <span class="ingredient-tag pantry">pantry</span></li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const freshHtml = freshIngredients.length > 0 ? `
    <div class="ingredient-group">
      <div class="ingredient-group-label fresh">🥦 Fresh ingredients</div>
      <ul class="ingredient-list">
        ${freshIngredients.map(i => `
          <li>${escapeHtml(i)} <span class="ingredient-tag fresh">fridge</span></li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  // Build step-by-step instructions
  const instructions = recipe.instructions || [];
  const stepsHtml = instructions.map(step => {
    // Strip any leading "Step N:" prefix since the CSS counter handles numbering
    const cleanStep = step.replace(/^Step\s+\d+:\s*/i, '');
    return `<li>${escapeHtml(cleanStep)}</li>`;
  }).join('');

  content.innerHTML = `
    <div>
      <!-- Recipe header -->
      <h1 class="page-title">${escapeHtml(recipe.name)}</h1>
      <div class="recipe-full-meta">
        <span class="badge">🕐 ${recipe.estimatedTime} min</span>
        <span class="badge">🍽️ ${escapeHtml(recipe.cuisine)}</span>
      </div>
      <p style="color: var(--muted); margin-bottom: 2rem;">${escapeHtml(recipe.description)}</p>

      <!-- Ingredients -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <h2 class="section-heading">Ingredients</h2>
        ${pantryHtml}
        ${freshHtml}
        ${(!pantryIngredients.length && !freshIngredients.length) ? '<p class="text-muted text-sm">No ingredients listed.</p>' : ''}
      </div>

      <!-- Instructions -->
      <div class="card" style="margin-bottom: 1.25rem;">
        <h2 class="section-heading">Instructions</h2>
        ${instructions.length > 0
          ? `<ol class="steps-list">${stepsHtml}</ol>`
          : '<p class="text-muted text-sm">No instructions available.</p>'
        }
      </div>

      <!-- Footer actions -->
      <div class="recipe-full-footer">
        <button class="btn btn-ghost" onclick="window.location.href='${backHref}'">${backLabel}</button>
        <button
          class="btn btn-primary"
          id="save-fav-btn"
          data-saved="${favouriteId ? 'true' : 'false'}"
          data-fav-id="${favouriteId || ''}"
        >
          ${favouriteId ? '❤️ Saved to Favourites' : '🤍 Save to Favourites'}
        </button>
      </div>
    </div>
  `;

  // Wire up the save button
  document.getElementById('save-fav-btn').addEventListener('click', () => toggleSave(recipe));
}

// -------------------------------------------------------
// toggleSave(recipe)
// Saves or unsaves the currently viewed recipe.
// -------------------------------------------------------
async function toggleSave(recipe) {
  const btn    = document.getElementById('save-fav-btn');
  const saved  = btn.dataset.saved === 'true';
  const favId  = btn.dataset.favId;

  if (saved && favId) {
    // Unsave
    const res = await fetch(`/api/favourites/${favId}`, { method: 'DELETE' });
    if (res.ok) {
      btn.textContent    = '🤍 Save to Favourites';
      btn.dataset.saved  = 'false';
      btn.dataset.favId  = '';
      showToast('Removed from favourites.');
    }
  } else {
    // Save
    const res = await fetch('/api/favourites', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:          recipe.name,
        description:   recipe.description,
        cuisine:       recipe.cuisine,
        estimatedTime: recipe.estimatedTime,
        ingredients:   recipe.ingredients,
        instructions:  recipe.instructions,
      }),
    });
    const data = await res.json();
    if (data.success) {
      btn.textContent    = '❤️ Saved to Favourites';
      btn.dataset.saved  = 'true';
      btn.dataset.favId  = data.id;
      showToast('Saved to favourites!', 'success');
    }
  }
}

// -------------------------------------------------------
// Page init
// -------------------------------------------------------
(async () => {
  const user = await initPage(null);
  if (!user) return;

  // Read the recipe to display from sessionStorage
  const stored = sessionStorage.getItem('viewingRecipe');

  if (!stored) {
    content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🍽️</span>
        <h3>No recipe to display</h3>
        <p>Go back to results or favourites to pick a recipe.</p>
        <a href="/results.html" class="btn btn-primary" style="margin-top:1rem;">Back to Results</a>
      </div>`;
    return;
  }

  const { recipe, pantryItems, fromFavourites, favouriteId } = JSON.parse(stored);
  document.title = `${recipe.name} — Recipe Suggester`;

  // Check current save status from server (in case it changed since the page was opened)
  let currentFavId = favouriteId;
  try {
    const res  = await fetch(`/api/favourites/check/${encodeURIComponent(recipe.name)}`);
    const data = await res.json();
    if (data.saved) currentFavId = data.id;
  } catch {
    // Non-critical — use whatever was stored
  }

  renderRecipe(recipe, pantryItems, fromFavourites, currentFavId);
})();

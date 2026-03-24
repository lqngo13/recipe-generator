// ============================================================
// results.js — Recipe Results page
// ============================================================
// Reads recipe data from sessionStorage (put there by search.js),
// renders recipe cards, and handles:
//   - Inline expand/collapse for full recipe view
//   - Save to Favourites (heart button)
//   - Find More Recipes (new API call, excluding already-shown recipes)
//   - Adjust Search (back to search.html with form pre-filled)

const container    = document.getElementById('results-container');
const footer       = document.getElementById('results-footer');
const findMoreBtn  = document.getElementById('find-more-btn');
const adjustBtn    = document.getElementById('adjust-search-btn');
const loadingState = document.getElementById('loading-state');

// -------------------------------------------------------
// renderResults(recipes)
// Builds and inserts a recipe card for each recipe in the array.
// -------------------------------------------------------
function renderResults(recipes) {
  container.innerHTML = '';

  if (!recipes || recipes.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🤷</span>
        <h3>No results found</h3>
        <p>Try adjusting your search or adding more ingredients.</p>
      </div>`;
    return;
  }

  recipes.forEach((recipe, index) => {
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.dataset.index = index;

    card.innerHTML = `
      <div class="recipe-card-body">
        <div class="recipe-name">${escapeHtml(recipe.name)}</div>
        <div class="recipe-desc">${escapeHtml(recipe.description)}</div>
        <div class="recipe-badges">
          <span class="badge">🕐 ${recipe.estimatedTime} min</span>
          <span class="badge">🍽️ ${escapeHtml(recipe.cuisine)}</span>
        </div>
        <button class="btn btn-ghost toggle-btn" data-index="${index}" style="margin-top:0.25rem;">
          ▼ See Full Recipe
        </button>
      </div>
      <div class="recipe-actions-col">
        <button
          class="save-btn"
          id="save-btn-${index}"
          data-index="${index}"
          aria-label="Save to favourites"
          title="Save to favourites"
        >🤍</button>
      </div>

      <!-- Expanded details panel — hidden until toggle is clicked -->
      <div class="recipe-details" id="details-${index}">
        ${buildDetailsHTML(recipe)}
      </div>
    `;

    container.appendChild(card);

    // Check if this recipe is already in favourites and update the heart
    checkIfSaved(index, recipe.name);
  });

  footer.style.display = 'flex';
}

// -------------------------------------------------------
// buildDetailsHTML(recipe)
// Builds the inner HTML for the expanded recipe panel.
// Called once per card when results are rendered.
// -------------------------------------------------------
function buildDetailsHTML(recipe) {
  const pantryItems   = JSON.parse(sessionStorage.getItem('pantryItems') || '[]');
  const pantryIngreds = recipe.ingredients?.pantry || [];
  const freshIngreds  = recipe.ingredients?.fresh  || [];

  const pantryHTML = pantryIngreds.length > 0 ? `
    <div class="ingredient-group">
      <div class="ingredient-group-label pantry">🧂 Pantry staples</div>
      <ul class="ingredient-list">
        ${pantryIngreds.map(i => `<li>${escapeHtml(i)} <span class="ingredient-tag pantry">pantry</span></li>`).join('')}
      </ul>
    </div>` : '';

  const freshHTML = freshIngreds.length > 0 ? `
    <div class="ingredient-group">
      <div class="ingredient-group-label fresh">🥦 Fresh ingredients</div>
      <ul class="ingredient-list">
        ${freshIngreds.map(i => `<li>${escapeHtml(i)} <span class="ingredient-tag fresh">fridge</span></li>`).join('')}
      </ul>
    </div>` : '';

  const instructions = recipe.instructions || [];
  const stepsHTML = instructions.map(step => {
    const clean = step.replace(/^Step\s+\d+:\s*/i, '');
    return `<li>${escapeHtml(clean)}</li>`;
  }).join('');

  // Only render source link if it's a valid https:// URL (guards against hallucinated links)
  const sourceHTML = recipe.sourceUrl && recipe.sourceUrl.startsWith('https://')
    ? `<div class="recipe-source">
        <a href="${escapeHtml(recipe.sourceUrl)}" target="_blank" rel="noopener noreferrer">
          View Original Recipe ↗
        </a>
        <span class="recipe-source-note">Link suggested by AI — verify before trusting</span>
       </div>`
    : '';

  return `
    <div class="recipe-details-inner">
      <div class="details-col">
        <h3 class="details-section-title">Ingredients</h3>
        ${pantryHTML}
        ${freshHTML}
        ${(!pantryIngreds.length && !freshIngreds.length) ? '<p class="text-muted text-sm">No ingredients listed.</p>' : ''}
      </div>
      <div class="details-col">
        <h3 class="details-section-title">Instructions</h3>
        ${instructions.length > 0
          ? `<ol class="steps-list">${stepsHTML}</ol>`
          : '<p class="text-muted text-sm">No instructions available.</p>'
        }
        ${sourceHTML}
      </div>
    </div>
  `;
}

// -------------------------------------------------------
// toggleExpand(index)
// Shows or hides the details panel for a recipe card.
// -------------------------------------------------------
function toggleExpand(index) {
  const details  = document.getElementById(`details-${index}`);
  const toggleBtn = document.querySelector(`.toggle-btn[data-index="${index}"]`);
  if (!details || !toggleBtn) return;

  const isOpen = details.classList.contains('open');
  details.classList.toggle('open', !isOpen);
  toggleBtn.textContent = isOpen ? '▼ See Full Recipe' : '▲ Hide Recipe';
}

// -------------------------------------------------------
// checkIfSaved(index, recipeName)
// Asks the server if this recipe is already in favourites.
// -------------------------------------------------------
async function checkIfSaved(index, recipeName) {
  try {
    const res  = await fetch(`/api/favourites/check/${encodeURIComponent(recipeName)}`);
    const data = await res.json();
    const btn  = document.getElementById(`save-btn-${index}`);
    if (btn && data.saved) {
      btn.textContent = '❤️';
      btn.classList.add('saved');
      btn.dataset.favouriteId = data.id;
    }
  } catch {
    // Non-critical
  }
}

// -------------------------------------------------------
// toggleSave(index)
// Saves or unsaves a recipe when the heart is clicked.
// -------------------------------------------------------
async function toggleSave(index) {
  const recipes = JSON.parse(sessionStorage.getItem('currentRecipes') || '[]');
  const recipe  = recipes[index];
  const btn     = document.getElementById(`save-btn-${index}`);
  if (!recipe || !btn) return;

  const alreadySaved = btn.classList.contains('saved');

  if (alreadySaved) {
    const favId = btn.dataset.favouriteId;
    if (!favId) return;
    const res = await fetch(`/api/favourites/${favId}`, { method: 'DELETE' });
    if (res.ok) {
      btn.textContent = '🤍';
      btn.classList.remove('saved');
      delete btn.dataset.favouriteId;
      showToast('Removed from favourites.');
    }
  } else {
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
      btn.textContent = '❤️';
      btn.classList.add('saved');
      btn.dataset.favouriteId = data.id;
      showToast('Saved to favourites!', 'success');
    }
  }
}

// -------------------------------------------------------
// Find More Recipes
// -------------------------------------------------------
findMoreBtn.addEventListener('click', async () => {
  const searchData   = JSON.parse(sessionStorage.getItem('searchData')   || '{}');
  const shownRecipes = JSON.parse(sessionStorage.getItem('shownRecipes') || '[]');

  container.innerHTML        = '';
  footer.style.display       = 'none';
  loadingState.style.display = 'block';

  try {
    const res = await fetch('/api/recipes/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...searchData, excludeRecipes: shownRecipes }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Search failed.');
    }

    const { recipes, pantryItems } = await res.json();

    sessionStorage.setItem('currentRecipes', JSON.stringify(recipes));
    sessionStorage.setItem('pantryItems',    JSON.stringify(pantryItems));
    const updatedShown = [...shownRecipes, ...recipes.map(r => r.name)];
    sessionStorage.setItem('shownRecipes', JSON.stringify(updatedShown));

    loadingState.style.display = 'none';
    renderResults(recipes);

  } catch (err) {
    loadingState.style.display = 'none';
    footer.style.display       = 'flex';
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
    const previous = JSON.parse(sessionStorage.getItem('currentRecipes') || '[]');
    renderResults(previous);
  }
});

// -------------------------------------------------------
// Adjust Search
// -------------------------------------------------------
adjustBtn.addEventListener('click', () => {
  window.location.href = '/search.html';
});

// -------------------------------------------------------
// Event delegation — handle toggle and heart clicks
// -------------------------------------------------------
container.addEventListener('click', (e) => {
  // Toggle expand button
  const toggleBtn = e.target.closest('.toggle-btn');
  if (toggleBtn) {
    toggleExpand(parseInt(toggleBtn.dataset.index, 10));
    return;
  }
  // Heart / save button
  const saveBtn = e.target.closest('.save-btn');
  if (saveBtn) {
    toggleSave(parseInt(saveBtn.dataset.index, 10));
  }
});

// -------------------------------------------------------
// Helper: escapeHtml
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
// Page init
// -------------------------------------------------------
(async () => {
  const user = await initPage('/search.html');
  if (!user) return;

  const recipes = JSON.parse(sessionStorage.getItem('currentRecipes') || 'null');

  if (!recipes) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🔍</span>
        <h3>No results to show</h3>
        <p>Start a new search to see recipe suggestions.</p>
        <a href="/search.html" class="btn btn-primary" style="margin-top:1rem;">Go to Search</a>
      </div>`;
    return;
  }

  renderResults(recipes);
})();

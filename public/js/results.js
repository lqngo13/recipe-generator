// ============================================================
// results.js — Recipe Results page
// ============================================================
// Reads recipe data from sessionStorage (put there by search.js),
// renders recipe cards, and handles:
//   - Save to Favourites (heart button)
//   - See Full Recipe (navigates to recipe.html)
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
        <button class="btn btn-ghost" onclick="viewFullRecipe(${index})" style="margin-top:0.25rem;">
          See Full Recipe →
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
    `;

    container.appendChild(card);

    // Check if this recipe is already in favourites and update the heart
    checkIfSaved(index, recipe.name);
  });

  footer.style.display = 'flex';
}

// -------------------------------------------------------
// checkIfSaved(index, recipeName)
// Asks the server if this recipe is already in the user's favourites,
// and updates the heart icon accordingly.
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
    // Non-critical — just leave the heart empty if check fails
  }
}

// -------------------------------------------------------
// toggleSave(index)
// Saves or unsaves a recipe when the heart button is clicked.
// -------------------------------------------------------
async function toggleSave(index) {
  const recipes = JSON.parse(sessionStorage.getItem('currentRecipes') || '[]');
  const recipe  = recipes[index];
  const btn     = document.getElementById(`save-btn-${index}`);
  if (!recipe || !btn) return;

  const alreadySaved = btn.classList.contains('saved');

  if (alreadySaved) {
    // Unsave
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
    // Save
    const res = await fetch('/api/favourites', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name:         recipe.name,
        description:  recipe.description,
        cuisine:      recipe.cuisine,
        estimatedTime: recipe.estimatedTime,
        ingredients:  recipe.ingredients,
        instructions: recipe.instructions,
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
// viewFullRecipe(index)
// Stores the selected recipe in sessionStorage and navigates to the full recipe page.
// -------------------------------------------------------
function viewFullRecipe(index) {
  const recipes     = JSON.parse(sessionStorage.getItem('currentRecipes') || '[]');
  const pantryItems = JSON.parse(sessionStorage.getItem('pantryItems')    || '[]');
  const recipe      = recipes[index];
  if (!recipe) return;

  // Pass the recipe and context to recipe.html via sessionStorage
  sessionStorage.setItem('viewingRecipe', JSON.stringify({
    recipe,
    pantryItems,
    fromFavourites: false,
    favouriteId:    null,
  }));

  window.location.href = '/recipe.html';
}

// -------------------------------------------------------
// Find More Recipes
// -------------------------------------------------------
// Uses the same search preferences but asks Claude for 5 different recipes,
// explicitly telling it which ones have already been shown.
findMoreBtn.addEventListener('click', async () => {
  const searchData    = JSON.parse(sessionStorage.getItem('searchData')    || '{}');
  const shownRecipes  = JSON.parse(sessionStorage.getItem('shownRecipes')  || '[]');

  container.innerHTML    = '';
  footer.style.display   = 'none';
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

    // Update sessionStorage with the new batch
    sessionStorage.setItem('currentRecipes', JSON.stringify(recipes));
    sessionStorage.setItem('pantryItems',    JSON.stringify(pantryItems));

    // Add new recipe names to the master "shown" list so they're excluded next time too
    const updatedShown = [...shownRecipes, ...recipes.map(r => r.name)];
    sessionStorage.setItem('shownRecipes', JSON.stringify(updatedShown));

    loadingState.style.display = 'none';
    renderResults(recipes);

  } catch (err) {
    loadingState.style.display = 'none';
    footer.style.display       = 'flex';
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
    // Re-render the previous results so the page isn't blank
    const previous = JSON.parse(sessionStorage.getItem('currentRecipes') || '[]');
    renderResults(previous);
  }
});

// -------------------------------------------------------
// Adjust Search
// -------------------------------------------------------
// Navigates back to the search page.
// The searchData is already in sessionStorage, so search.js will pre-fill everything.
adjustBtn.addEventListener('click', () => {
  window.location.href = '/search.html';
});

// -------------------------------------------------------
// Delegate heart button clicks
// -------------------------------------------------------
container.addEventListener('click', (e) => {
  const btn = e.target.closest('.save-btn');
  if (btn) {
    toggleSave(parseInt(btn.dataset.index, 10));
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
  const user = await initPage('/search.html'); // Keep "Find Recipes" highlighted
  if (!user) return;

  // Load results from sessionStorage (put there by search.js)
  const recipes = JSON.parse(sessionStorage.getItem('currentRecipes') || 'null');

  if (!recipes) {
    // No results in storage — user probably navigated here directly
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

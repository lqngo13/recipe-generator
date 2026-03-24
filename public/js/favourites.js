// ============================================================
// favourites.js — My Favourites page
// ============================================================
// Loads the user's saved recipes from the server and displays them as a list.
// Clicking a recipe opens the full recipe view.
// The trash icon removes a recipe from favourites.

const listEl = document.getElementById('favourites-list');

// -------------------------------------------------------
// loadFavourites()
// Fetches and renders all saved recipes for the logged-in user.
// -------------------------------------------------------
async function loadFavourites() {
  listEl.innerHTML = `
    <div class="loading-state">
      <span class="loading-spinner">🍳</span>
      <p>Loading your favourites…</p>
    </div>`;

  try {
    const res        = await fetch('/api/favourites');
    const favourites = await res.json();

    if (favourites.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">❤️</span>
          <h3>No favourites yet</h3>
          <p>Save recipes from your search results and they'll appear here.</p>
          <a href="/search.html" class="btn btn-primary" style="margin-top:1rem;">Find Recipes</a>
        </div>`;
      return;
    }

    listEl.innerHTML = `<div class="fav-list" id="fav-list"></div>`;
    const favList    = document.getElementById('fav-list');

    favourites.forEach(fav => {
      const item = document.createElement('div');
      item.className    = 'fav-item';
      item.dataset.id   = fav.id;

      item.innerHTML = `
        <div class="fav-item-info">
          <div class="fav-item-name">${escapeHtml(fav.recipe_name)}</div>
          <div class="fav-item-meta">
            <span>🍽️ ${escapeHtml(fav.cuisine || 'Unknown')}</span>
            <span>🕐 ${fav.estimated_time} min</span>
          </div>
        </div>
        <button
          class="fav-remove-btn"
          data-id="${fav.id}"
          aria-label="Remove ${escapeHtml(fav.recipe_name)} from favourites"
          title="Remove from favourites"
        >🗑️</button>
      `;

      // Clicking anywhere on the row (except the delete button) opens the recipe
      item.addEventListener('click', (e) => {
        if (e.target.closest('.fav-remove-btn')) return; // Handled separately
        viewFavourite(fav);
      });

      favList.appendChild(item);
    });

    // Wire up all delete buttons at once via event delegation
    favList.addEventListener('click', async (e) => {
      const btn = e.target.closest('.fav-remove-btn');
      if (!btn) return;
      await removeFavourite(parseInt(btn.dataset.id, 10));
    });

  } catch {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <h3>Could not load favourites</h3>
        <p>Please try refreshing the page.</p>
      </div>`;
  }
}

// -------------------------------------------------------
// removeFavourite(id)
// Deletes a saved recipe and removes its row from the page.
// -------------------------------------------------------
async function removeFavourite(id) {
  try {
    const res = await fetch(`/api/favourites/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();

    // Remove the item from the DOM without re-fetching everything
    const el = document.querySelector(`.fav-item[data-id="${id}"]`);
    if (el) {
      el.style.transition = 'opacity 0.2s';
      el.style.opacity    = '0';
      setTimeout(() => {
        el.remove();
        // Show empty state if no items remain
        const remaining = document.querySelectorAll('.fav-item');
        if (remaining.length === 0) loadFavourites();
      }, 200);
    }

    showToast('Recipe removed from favourites.');
  } catch {
    showToast('Could not remove recipe. Please try again.', 'error');
  }
}

// -------------------------------------------------------
// viewFavourite(fav)
// Stores the recipe in sessionStorage and navigates to the full recipe page.
// -------------------------------------------------------
function viewFavourite(fav) {
  // The recipe data from the DB uses snake_case field names, so we normalise it
  const recipe = {
    name:          fav.recipe_name,
    description:   fav.description,
    cuisine:       fav.cuisine,
    estimatedTime: fav.estimated_time,
    ingredients:   fav.ingredients,   // already parsed to object by the API
    instructions:  fav.instructions,  // already parsed to array by the API
  };

  sessionStorage.setItem('viewingRecipe', JSON.stringify({
    recipe,
    pantryItems:    [],
    fromFavourites: true,
    favouriteId:    fav.id,
  }));

  window.location.href = '/recipe.html';
}

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
  const user = await initPage('/favourites.html');
  if (!user) return;
  await loadFavourites();
})();

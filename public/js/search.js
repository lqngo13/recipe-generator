// ============================================================
// search.js — Find Recipes page
// ============================================================
// Handles:
//   - Cuisine checkbox logic (Any, sub-cuisine override)
//   - Time slider display
//   - Pre-filling the form if the user came back via "Adjust Search"
//   - Calling the API and storing results in sessionStorage before redirecting

// -------------------------------------------------------
// DOM references
// -------------------------------------------------------
const fridgeInput  = document.getElementById('fridge-input');
const timeSlider   = document.getElementById('time-slider');
const timeDisplay  = document.getElementById('time-display');
const grainSelect  = document.getElementById('grain-select');
const notesInput   = document.getElementById('notes-input');
const searchBtn    = document.getElementById('search-btn');
const loadingState = document.getElementById('loading-state');
const vietHint     = document.getElementById('viet-hint');
const cuisineAny   = document.getElementById('cuisine-any');
const cuisineViet  = document.getElementById('cuisine-viet');

// -------------------------------------------------------
// Time slider: update display as slider moves
// -------------------------------------------------------
timeSlider.addEventListener('input', () => {
  timeDisplay.textContent = `${timeSlider.value} minutes`;
});

// -------------------------------------------------------
// Cuisine checkbox logic
// -------------------------------------------------------
const allCuisineCheckboxes = document.querySelectorAll('input[name="cuisine"]');

allCuisineCheckboxes.forEach(checkbox => {
  checkbox.addEventListener('change', handleCuisineChange);
});

function handleCuisineChange(e) {
  const changed = e.target;

  if (changed.value === 'Any' && changed.checked) {
    // "Any" was just checked — uncheck everything else
    allCuisineCheckboxes.forEach(cb => {
      if (cb.value !== 'Any') cb.checked = false;
    });
  } else if (changed.value !== 'Any' && changed.checked) {
    // A specific cuisine was checked — uncheck "Any"
    cuisineAny.checked = false;
  }

  // If no cuisine is checked, default back to "Any"
  const anyChecked = [...allCuisineCheckboxes].some(cb => cb.checked);
  if (!anyChecked) {
    cuisineAny.checked = true;
  }

  // Show the Vietnamese override hint when Vietnamese is selected
  vietHint.style.display = cuisineViet.checked ? 'block' : 'none';
}

// -------------------------------------------------------
// getSelectedCuisines()
// Returns an array of the currently checked cuisine values.
// -------------------------------------------------------
function getSelectedCuisines() {
  return [...allCuisineCheckboxes]
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

// -------------------------------------------------------
// Pre-fill the form from sessionStorage
// -------------------------------------------------------
// When the user clicks "Adjust Search" on the results page,
// the previous search data is stored in sessionStorage under 'searchData'.
// We read it here to restore all fields exactly as they were left.
function prefillForm() {
  const stored = sessionStorage.getItem('searchData');
  if (!stored) return; // Nothing stored — fresh search, leave defaults

  try {
    const data = JSON.parse(stored);

    if (data.fridgeIngredients) fridgeInput.value = data.fridgeIngredients;
    if (data.time)              {
      timeSlider.value           = data.time;
      timeDisplay.textContent    = `${data.time} minutes`;
    }
    if (data.grain)             grainSelect.value = data.grain;
    if (data.notes)             notesInput.value  = data.notes;

    // Restore cuisine checkboxes
    if (data.cuisines && Array.isArray(data.cuisines)) {
      allCuisineCheckboxes.forEach(cb => {
        cb.checked = data.cuisines.includes(cb.value);
      });
      // Show Vietnamese hint if it was checked
      vietHint.style.display = cuisineViet.checked ? 'block' : 'none';
    }
  } catch {
    // If parsing fails, just leave the form at defaults
  }
}

// -------------------------------------------------------
// Search form submission
// -------------------------------------------------------
searchBtn.addEventListener('click', async () => {
  const fridgeIngredients = fridgeInput.value.trim();

  if (!fridgeIngredients) {
    showToast('Please enter what\'s in your fridge first.', 'error');
    fridgeInput.focus();
    return;
  }

  const searchData = {
    fridgeIngredients,
    time:    parseInt(timeSlider.value, 10),
    cuisines: getSelectedCuisines(),
    grain:   grainSelect.value,
    notes:   notesInput.value.trim(),
  };

  // Save search inputs so results.html and recipe.html can access them,
  // and so "Adjust Search" can restore the form
  sessionStorage.setItem('searchData', JSON.stringify(searchData));

  // Clear any previous results and "shown recipes" list
  sessionStorage.removeItem('currentRecipes');
  sessionStorage.removeItem('shownRecipes');
  sessionStorage.removeItem('pantryItems');

  // Show loading state
  searchBtn.style.display    = 'none';
  loadingState.style.display = 'block';

  try {
    const res  = await fetch('/api/recipes/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...searchData, excludeRecipes: [] }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Search failed.');
    }

    const { recipes, pantryItems } = await res.json();

    // Store results and pantry items in sessionStorage for the results page to read
    sessionStorage.setItem('currentRecipes', JSON.stringify(recipes));
    sessionStorage.setItem('pantryItems',    JSON.stringify(pantryItems));
    // Track all shown recipe names (used by "Find More" to avoid repeats)
    sessionStorage.setItem('shownRecipes',   JSON.stringify(recipes.map(r => r.name)));

    // Navigate to the results page
    window.location.href = '/results.html';

  } catch (err) {
    showToast(err.message || 'Something went wrong. Please try again.', 'error');
    searchBtn.style.display    = 'block';
    loadingState.style.display = 'none';
  }
});

// -------------------------------------------------------
// Page init
// -------------------------------------------------------
(async () => {
  const user = await initPage('/search.html');
  if (!user) return;
  prefillForm(); // Restore previous inputs if coming back from "Adjust Search"
})();

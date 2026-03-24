// ============================================================
// search.js — Find Recipes page
// ============================================================

// -------------------------------------------------------
// DOM references
// -------------------------------------------------------
const fridgeInput  = document.getElementById('fridge-input');
const timeSlider   = document.getElementById('time-slider');
const timeDisplay  = document.getElementById('time-display');
const timeHint     = document.getElementById('time-hint');
const passiveOkCb  = document.getElementById('passive-ok');
const grainSelect  = document.getElementById('grain-select');
const notesInput   = document.getElementById('notes-input');
const searchBtn    = document.getElementById('search-btn');
const loadingState = document.getElementById('loading-state');
const cuisineAny   = document.getElementById('cuisine-any');

// All top-level cuisine checkboxes (name="cuisine")
const cuisineCheckboxes = document.querySelectorAll('input[name="cuisine"]');
// All sub-cuisine checkboxes (name="cuisine-sub", each has data-parent attribute)
const subCheckboxes     = document.querySelectorAll('input[name="cuisine-sub"]');

// -------------------------------------------------------
// Time slider
// -------------------------------------------------------
timeSlider.addEventListener('input', updateTimeDisplay);

function updateTimeDisplay() {
  timeDisplay.textContent = `${timeSlider.value} minutes`;
}

// Update the hint text below the slider based on the passive toggle
passiveOkCb.addEventListener('change', () => {
  timeHint.textContent = passiveOkCb.checked
    ? 'Active cooking time only — marinating, baking, and other passive steps don\'t count.'
    : 'Includes all prep, marinating, and cooking time.';
});

// -------------------------------------------------------
// Cuisine logic
// -------------------------------------------------------
// When a parent cuisine (e.g. Asian) is checked, reveal its sub-cuisine group.
// When unchecked, hide the group and uncheck all its sub-cuisines.
// The sub-group element must have id="subs-{ParentValue}" e.g. "subs-Asian".
// This pattern works for any future parent cuisines added.

cuisineCheckboxes.forEach(cb => cb.addEventListener('change', handleParentCuisineChange));
subCheckboxes.forEach(cb => cb.addEventListener('change', handleSubCuisineChange));

function handleParentCuisineChange(e) {
  const changed = e.target;

  if (changed.value === 'Any' && changed.checked) {
    // "Any" checked — uncheck all parents and all sub-cuisines
    cuisineCheckboxes.forEach(cb => { if (cb.value !== 'Any') cb.checked = false; });
    subCheckboxes.forEach(cb => { cb.checked = false; });
  } else if (changed.value !== 'Any' && changed.checked) {
    // A specific parent was checked — uncheck "Any"
    cuisineAny.checked = false;
  }

  // If nothing is checked, fall back to "Any"
  const anyChecked = [...cuisineCheckboxes].some(cb => cb.checked);
  if (!anyChecked) cuisineAny.checked = true;

  // Show or hide this parent's sub-group
  updateSubGroup(changed.value, changed.checked);

  updateSubHint();
}

function handleSubCuisineChange(e) {
  // When a sub-cuisine is checked, make sure its parent is also checked
  if (e.target.checked) {
    const parentValue = e.target.dataset.parent;
    const parentCb = document.querySelector(`input[name="cuisine"][value="${parentValue}"]`);
    if (parentCb && !parentCb.checked) {
      parentCb.checked = true;
      cuisineAny.checked = false;
    }
  }
  updateSubHint();
}

// Show or hide the sub-cuisine group for a given parent cuisine value.
// Also unchecks the sub-cuisines when the parent is unchecked.
function updateSubGroup(parentValue, show) {
  const group = document.getElementById(`subs-${parentValue}`);
  if (!group) return; // This parent has no sub-cuisines — nothing to do

  group.classList.toggle('open', show);

  if (!show) {
    // Uncheck all sub-cuisines belonging to this parent
    group.querySelectorAll('input[name="cuisine-sub"]').forEach(cb => { cb.checked = false; });
  }
}

// Update the hint message inside an open sub-group based on what's selected
function updateSubHint() {
  const hintEl = document.getElementById('sub-selected-hint');
  if (!hintEl) return;

  const checkedSubs = [...subCheckboxes].filter(cb => cb.checked).map(cb => cb.value);

  if (checkedSubs.length > 0) {
    hintEl.textContent = `⚠️ Strict mode: AI will suggest only ${checkedSubs.join(' and ')} recipes.`;
    hintEl.style.display = 'block';
  } else {
    hintEl.style.display = 'none';
  }
}

// -------------------------------------------------------
// getSelectedCuisines()
// Returns a flat array of all checked cuisine values (parents + subs).
// The backend uses this array and its own cuisine tree to apply the right logic.
// -------------------------------------------------------
function getSelectedCuisines() {
  const parents = [...cuisineCheckboxes].filter(cb => cb.checked).map(cb => cb.value);
  const subs    = [...subCheckboxes].filter(cb => cb.checked).map(cb => cb.value);
  return [...parents, ...subs];
}

// -------------------------------------------------------
// prefillForm()
// Restores all form fields from sessionStorage when coming back via "Adjust Search".
// -------------------------------------------------------
function prefillForm() {
  const stored = sessionStorage.getItem('searchData');
  if (!stored) return;

  try {
    const data = JSON.parse(stored);

    if (data.fridgeIngredients) fridgeInput.value = data.fridgeIngredients;
    if (data.time) {
      timeSlider.value        = data.time;
      timeDisplay.textContent = `${data.time} minutes`;
    }
    if (data.grain) grainSelect.value = data.grain;
    if (data.notes) notesInput.value  = data.notes;

    // Restore passive toggle
    if (data.passiveOk) {
      passiveOkCb.checked = true;
      timeHint.textContent = 'Active cooking time only — marinating, baking, and other passive steps don\'t count.';
    }

    // Restore parent cuisine checkboxes
    if (data.cuisines && Array.isArray(data.cuisines)) {
      cuisineCheckboxes.forEach(cb => {
        cb.checked = data.cuisines.includes(cb.value);
      });

      // Show sub-groups for any checked parents
      cuisineCheckboxes.forEach(cb => {
        if (cb.checked && cb.value !== 'Any') {
          updateSubGroup(cb.value, true);
        }
      });

      // Restore sub-cuisine checkboxes
      subCheckboxes.forEach(cb => {
        cb.checked = data.cuisines.includes(cb.value);
      });

      updateSubHint();
    }
  } catch {
    // Parsing failed — leave form at defaults
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
    time:      parseInt(timeSlider.value, 10),
    cuisines:  getSelectedCuisines(),
    grain:     grainSelect.value,
    notes:     notesInput.value.trim(),
    passiveOk: passiveOkCb.checked,
  };

  sessionStorage.setItem('searchData', JSON.stringify(searchData));
  sessionStorage.removeItem('currentRecipes');
  sessionStorage.removeItem('shownRecipes');
  sessionStorage.removeItem('pantryItems');

  searchBtn.style.display    = 'none';
  loadingState.style.display = 'block';

  try {
    const res = await fetch('/api/recipes/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...searchData, excludeRecipes: [] }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Search failed.');
    }

    const { recipes, pantryItems } = await res.json();

    sessionStorage.setItem('currentRecipes', JSON.stringify(recipes));
    sessionStorage.setItem('pantryItems',    JSON.stringify(pantryItems));
    sessionStorage.setItem('shownRecipes',   JSON.stringify(recipes.map(r => r.name)));

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
  prefillForm();
})();

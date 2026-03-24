// ============================================================
// pantry.js — My Pantry page
// ============================================================
// Lets the user build a list of pantry staples.
// Items are shown as removable chips, and saved to the database on "Save Pantry".

// This array holds the current pantry items in memory while the user edits.
// It's synced to the server when they click Save.
let pantryItems = [];

const chipList   = document.getElementById('chip-list');
const emptyHint  = document.getElementById('empty-hint');
const input      = document.getElementById('pantry-input');
const addBtn     = document.getElementById('add-btn');
const saveBtn    = document.getElementById('save-btn');
const saveStatus = document.getElementById('save-status');

// -------------------------------------------------------
// renderChips()
// Clears and re-draws the chip list from the pantryItems array.
// -------------------------------------------------------
function renderChips() {
  chipList.innerHTML = '';
  emptyHint.style.display = pantryItems.length === 0 ? 'block' : 'none';

  pantryItems.forEach((item, index) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `
      ${escapeHtml(item)}
      <button class="chip-remove" data-index="${index}" aria-label="Remove ${escapeHtml(item)}">×</button>
    `;
    chipList.appendChild(chip);
  });
}

// -------------------------------------------------------
// addItem()
// Reads the input field and adds the value to pantryItems.
// -------------------------------------------------------
function addItem() {
  const value = input.value.trim();
  if (!value) return;

  // Split by comma in case they type "salt, pepper, garlic" all at once
  const newItems = value.split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const item of newItems) {
    // Don't add duplicates (case-insensitive check)
    if (!pantryItems.some(existing => existing.toLowerCase() === item.toLowerCase())) {
      pantryItems.push(item);
    }
  }

  input.value = '';
  saveStatus.textContent = ''; // Clear any old save message
  renderChips();
}

// -------------------------------------------------------
// removeItem(index)
// Removes an item from pantryItems by its index in the array.
// -------------------------------------------------------
function removeItem(index) {
  pantryItems.splice(index, 1);
  saveStatus.textContent = '';
  renderChips();
}

// -------------------------------------------------------
// savePantry()
// Sends the current pantryItems array to the server to be saved.
// -------------------------------------------------------
async function savePantry() {
  saveBtn.disabled = true;
  saveStatus.textContent = 'Saving...';

  try {
    const res = await fetch('/api/pantry', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ingredients: pantryItems }),
    });

    if (!res.ok) throw new Error('Save failed');

    saveStatus.textContent = '✓ Saved!';
    showToast('Pantry saved!', 'success');
  } catch {
    saveStatus.textContent = 'Save failed. Try again.';
    showToast('Could not save pantry.', 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

// -------------------------------------------------------
// loadPantry()
// Fetches the user's saved pantry from the server on page load.
// -------------------------------------------------------
async function loadPantry() {
  try {
    const res  = await fetch('/api/pantry');
    const data = await res.json();
    pantryItems = data.map(row => row.ingredient);
    renderChips();
  } catch {
    showToast('Could not load pantry.', 'error');
  }
}

// -------------------------------------------------------
// Helper: escapeHtml
// Prevents XSS by escaping HTML characters in user-entered text
// before inserting it into the DOM with innerHTML.
// -------------------------------------------------------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -------------------------------------------------------
// Event listeners
// -------------------------------------------------------

// Add button click
addBtn.addEventListener('click', addItem);

// Press Enter in the input field to add
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addItem();
  }
});

// Clicking the × on a chip removes that item
chipList.addEventListener('click', (e) => {
  if (e.target.classList.contains('chip-remove')) {
    removeItem(parseInt(e.target.dataset.index, 10));
  }
});

// Save button
saveBtn.addEventListener('click', savePantry);

// -------------------------------------------------------
// Page init
// -------------------------------------------------------
(async () => {
  const user = await initPage('/pantry.html');
  if (!user) return;
  await loadPantry();
})();

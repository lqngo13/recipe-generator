// ============================================================
// shared.js — included on every page except login
// ============================================================
// Handles:
//   1. Auth check on page load (redirect to login if not logged in)
//   2. Populating the nav with the user's name
//   3. Logout button
//   4. Toast notification helper

// -------------------------------------------------------
// initPage()
// Call this at the top of every protected page's JS file.
// It checks the session, fills in the username, and sets up logout.
// Returns the user object { userId, username } for use on the page.
// -------------------------------------------------------
async function initPage(activeNavLink) {
  const user = await checkAuth();
  if (!user) return null;

  // Show the user's name in the nav
  const el = document.getElementById('nav-username');
  if (el) el.textContent = user.username;

  // Highlight the current page link in the nav
  if (activeNavLink) {
    const link = document.querySelector(`.nav-links a[href="${activeNavLink}"]`);
    if (link) link.classList.add('active');
  }

  // Wire up the logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  return user;
}

// -------------------------------------------------------
// checkAuth()
// Calls /auth/me. If the user is not logged in, redirects to login.
// -------------------------------------------------------
async function checkAuth() {
  try {
    const res = await fetch('/auth/me');
    if (!res.ok) {
      // Not logged in — send to login page
      window.location.href = '/';
      return null;
    }
    return await res.json();
  } catch {
    window.location.href = '/';
    return null;
  }
}

// -------------------------------------------------------
// logout()
// Calls /auth/logout then redirects to the login page.
// -------------------------------------------------------
async function logout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/';
}

// -------------------------------------------------------
// showToast(message, type)
// Shows a small notification at the bottom-right of the screen.
// type: 'default' | 'success' | 'error'
// -------------------------------------------------------
function showToast(message, type = 'default') {
  // Create the toast element if it doesn't exist yet
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  // Set the message and style
  toast.textContent = message;
  toast.className = `toast ${type}`;

  // Show it, then hide after 2.5 seconds
  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  });
}

// ============================================================
// main.js — Login page
// ============================================================

const form     = document.getElementById('login-form');
const errorMsg = document.getElementById('error-msg');
const loginBtn = document.getElementById('login-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault(); // Don't let the browser do a full page reload

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  errorMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in...';

  try {
    const res  = await fetch('/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Show the error returned by the server (e.g. "Invalid username or password")
      errorMsg.textContent = data.error || 'Login failed.';
      loginBtn.disabled    = false;
      loginBtn.textContent = 'Log in';
      return;
    }

    // Login successful — go to the dashboard
    window.location.href = '/dashboard.html';

  } catch {
    errorMsg.textContent = 'Could not connect to the server. Is it running?';
    loginBtn.disabled    = false;
    loginBtn.textContent = 'Log in';
  }
});

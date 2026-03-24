// ============================================================
// dashboard.js — Dashboard / home screen
// ============================================================

(async () => {
  // Check auth and populate the nav username
  const user = await initPage('/dashboard.html');
  if (!user) return;

  // Personalise the greeting with the logged-in user's name
  document.getElementById('greeting-name').textContent = user.username;
  document.title = `Hi ${user.username} — Recipe Suggester`;
})();

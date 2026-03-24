// -------------------------------------------------------
// Auth routes: login, logout, and session check
// -------------------------------------------------------

const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');

const router = express.Router();

// POST /auth/login
// The frontend sends { username, password } and we check the credentials
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  // Find the user by username (case-insensitive because of COLLATE NOCASE on the table)
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user) {
    // Don't reveal whether the username or password was wrong — just say "invalid"
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Compare the submitted plain-text password against the stored hash
  const passwordMatch = bcrypt.compareSync(password, user.password);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Store the user's ID and username in the session
  // This is what keeps them "logged in" as they navigate between pages
  req.session.userId   = user.id;
  req.session.username = user.username;

  res.json({ success: true, username: user.username });
});

// POST /auth/logout
// Destroys the session, effectively logging the user out
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// GET /auth/me
// Called by every protected page on load — returns who's logged in, or 401 if nobody is
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in.' });
  }
  res.json({
    userId:   req.session.userId,
    username: req.session.username
  });
});

module.exports = router;

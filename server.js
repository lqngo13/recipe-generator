// Load environment variables from the .env file (API keys, secrets, etc.)
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
// Parse incoming JSON from fetch() calls in the frontend
app.use(express.json());
// Parse form submissions (not heavily used but good to have)
app.use(express.urlencoded({ extended: true }));
// Serve everything in the /public folder as static files (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));

// --- Sessions ---
// Sessions keep users "logged in" between page loads.
// When a user logs in, we store their user ID in the session.
// On every subsequent request, Express reads that session to know who's making the request.
app.use(session({
  secret: process.env.SESSION_SECRET || 'recipe-app-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,                    // Set to true if you deploy with HTTPS
    maxAge: 24 * 60 * 60 * 1000      // Sessions last 24 hours
  }
}));

// --- Routes ---
// Each file in /routes handles a different area of the app
app.use('/auth',           require('./routes/auth'));        // Login, logout, session check
app.use('/api/pantry',     require('./routes/pantry'));      // Pantry items
app.use('/api/recipes',    require('./routes/recipes'));     // Claude AI recipe search
app.use('/api/favourites', require('./routes/favourites')); // Saved recipes

// --- Start server ---
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

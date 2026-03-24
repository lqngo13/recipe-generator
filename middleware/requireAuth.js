// -------------------------------------------------------
// requireAuth middleware
// -------------------------------------------------------
// This function runs before any protected API route.
// It checks if the user has an active session (i.e. is logged in).
// If not, it sends a 401 error instead of running the route.
//
// Usage in a route file:
//   router.use(requireAuth);   ← protects all routes in that file
//   router.get('/', requireAuth, handler);  ← protects one route

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    // No session — user is not logged in
    return res.status(401).json({ error: 'You must be logged in to do that.' });
  }
  // Session exists — let the request continue to the route handler
  next();
}

module.exports = requireAuth;

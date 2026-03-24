// index.js is kept minimal — Express's static middleware in server.js
// already handles serving HTML files from the /public folder.
// Add any catch-all or redirect routes here if needed in future.

const express = require('express');
const router  = express.Router();

module.exports = router;

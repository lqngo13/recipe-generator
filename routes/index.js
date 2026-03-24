const express = require('express');
const router = express.Router();
// const db = require('../db/database');

// GET /
router.get('/', (req, res) => {
  res.sendFile('index.html');
});

// TODO: add more routes here

module.exports = router;

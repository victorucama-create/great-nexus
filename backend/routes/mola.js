const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Mock Mola routes
router.get('/investments', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Investments endpoint',
    investments: [] 
  });
});

router.post('/investments', authenticateToken, (req, res) => {
  res.json({ message: 'Create investment endpoint' });
});

module.exports = router;

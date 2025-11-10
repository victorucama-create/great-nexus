const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Mock ERP routes - will be implemented fully later
router.get('/products', authenticateToken, (req, res) => {
  res.json({ 
    message: 'Products endpoint',
    products: [] 
  });
});

router.post('/products', authenticateToken, (req, res) => {
  res.json({ message: 'Create product endpoint' });
});

module.exports = router;

const express = require('express');
const { 
  register, 
  login, 
  getMe, 
  testAuth
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/test', testAuth);
router.post('/register', register);
router.post('/login', login);

// Protected routes - require authentication
router.get('/me', protect, getMe);

module.exports = router; 
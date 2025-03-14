const express = require('express');
const { 
  register, 
  login, 
  logout, 
  getMe, 
  testAuth, 
  refreshToken,
  logoutAll
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/test', testAuth);
router.post('/register', register);
router.post('/login', login);
router.post('/refresh-token', refreshToken);

// Protected routes - require authentication
router.get('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);
router.get('/me', protect, getMe);

module.exports = router; 
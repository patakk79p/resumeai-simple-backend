const express = require('express');
const { register, login, logout, getMe, testAuth } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Test route to verify auth routes are working
router.get('/test', testAuth);

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router; 
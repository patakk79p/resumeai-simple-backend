const User = require('../models/User');
const tokenUtils = require('../utils/tokenUtils');
const crypto = require('crypto');

/**
 * @desc    Register user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    console.log('Register request received:', JSON.stringify(req.body, null, 2));
    
    // Extract user data from request
    const { name, email, password } = req.body;
    
    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email and password'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'Email already in use'
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password
    });

    console.log('User created successfully:', user._id);
    
    // Create tokens
    await sendTokenResponse(user, 201, res, req);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Registration failed. Please try again.',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    console.log('Login request received for email:', req.body.email);
    
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('Login failed: User not found:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      console.log('Login failed: Invalid password for user:', user._id);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log('Login successful for user:', user._id);
    
    // Create tokens
    await sendTokenResponse(user, 200, res, req);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Login failed. Please try again.',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public
 */
exports.refreshToken = async (req, res) => {
  try {
    // Get refresh token from cookie or request body
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'No refresh token provided'
      });
    }
    
    // Rotate the refresh token
    const { accessToken, refreshToken: newRefreshToken, user } = 
      await tokenUtils.rotateRefreshToken(refreshToken, req);
    
    // Set cookies
    setTokenCookies(res, accessToken, newRefreshToken);
    
    // Return new tokens
    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    
    if (err.message === 'Token reuse detected') {
      return res.status(401).json({
        success: false,
        error: 'Security breach detected. Please login again.',
        isSecurityBreach: true
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
};

/**
 * @desc    Logout user
 * @route   GET /api/v1/auth/logout
 * @access  Private
 */
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    
    // If we have a refresh token, revoke it
    if (refreshToken) {
      await tokenUtils.revokeToken(refreshToken, 'manual_logout');
    }
    
    // Clear cookies
    res.cookie('accessToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'None',
      path: '/'
    });
    
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'None',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Could not retrieve user information'
    });
  }
};

/**
 * @desc    Test auth route
 * @route   GET /api/v1/auth/test
 * @access  Public
 */
exports.testAuth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth routes are working',
    timestamp: new Date().toISOString(),
    isAuthenticated: !!req.user,
    user: req.user ? {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role
    } : null
  });
};

/**
 * @desc    Manually invalidate all user tokens (logout everywhere)
 * @route   POST /api/v1/auth/logout-all
 * @access  Private
 */
exports.logoutAll = async (req, res) => {
  try {
    // Revoke all user tokens
    const count = await tokenUtils.revokeAllUserTokens(req.user.id, 'manual_logout');
    
    // Clear cookies
    res.cookie('accessToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'None',
      path: '/'
    });
    
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'None',
      path: '/'
    });

    res.status(200).json({
      success: true,
      message: `Successfully logged out from all devices. Revoked ${count} tokens.`
    });
  } catch (err) {
    console.error('Logout all error:', err.message);
    res.status(500).json({
      success: false,
      error: 'Logout from all devices failed'
    });
  }
};

// Helper function to set cookies for tokens
const setTokenCookies = (res, accessToken, refreshToken) => {
  // Access token cookie (short-lived)
  const accessTokenExpire = process.env.JWT_ACCESS_EXPIRE || '15m';
  const accessExpireMs = accessTokenExpire.includes('m') 
    ? parseInt(accessTokenExpire) * 60 * 1000 
    : parseInt(accessTokenExpire) * 1000;
  
  res.cookie('accessToken', accessToken, {
    expires: new Date(Date.now() + accessExpireMs),
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'None',
    path: '/'
  });
  
  // Refresh token cookie (long-lived)
  const refreshExpireDays = parseInt(process.env.JWT_REFRESH_EXPIRE_DAYS || '7');
  const refreshExpireMs = refreshExpireDays * 24 * 60 * 60 * 1000;
  
  res.cookie('refreshToken', refreshToken, {
    expires: new Date(Date.now() + refreshExpireMs),
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'None',
    path: '/'
  });
};

// Helper function to create tokens and send response
const sendTokenResponse = async (user, statusCode, res, req) => {
  try {
    // Generate JWT
    const accessToken = tokenUtils.generateAccessToken(user);
    
    // Generate refresh token
    const { plainToken: refreshToken } = await tokenUtils.createRefreshToken(user, null, req);
    
    // Set cookies
    setTokenCookies(res, accessToken, refreshToken);
    
    // Return response
    return res.status(statusCode).json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Error creating tokens:', error);
    throw error;
  }
}; 
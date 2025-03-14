const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Route protection middleware
 * Verifies JWT access token and attaches user to request
 */
exports.protect = async (req, res, next) => {
  try {
    // Log request info for debugging
    const authHeader = req.headers.authorization 
      ? `${req.headers.authorization.substring(0, 15)}...` 
      : 'none';
    console.log(`Auth attempt: ${req.method} ${req.originalUrl} | Auth header: ${authHeader}`);
    
    // Extract token from authorization header or cookie
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // Check token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied: No token provided'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user
      const user = await User.findById(decoded.id);
      
      // Check if user exists
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Attach user to request
      req.user = user;
      next();
      
    } catch (error) {
      // Handle token verification errors
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired',
          isExpired: true
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
      
      // Handle other errors
      console.error('Token verification error:', error);
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error in authentication'
    });
  }
};

/**
 * Role-based access control middleware
 * Ensures user has one of the specified roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user is attached
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authorization failed: User not authenticated'
      });
    }
    
    // Check if user role is allowed
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied: User role '${req.user.role}' is not authorized for this resource`
      });
    }
    
    next();
  };
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is valid, but doesn't block if no token
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    // Extract token from authorization header or cookie
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // If no token, continue without authentication
    if (!token) {
      return next();
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find user
      const user = await User.findById(decoded.id);
      
      // Attach user to request if found
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // Continue without user if token invalid
      console.log('Optional auth token invalid:', error.message);
    }
    
    next();
  } catch (error) {
    // Don't block request on error, just log it
    console.error('Optional auth error:', error);
    next();
  }
}; 
const passport = require('passport');
const User = require('../models/User');

/**
 * Protect routes - require authentication
 */
exports.protect = passport.authenticate('jwt', { session: false });

/**
 * Role-based access control middleware
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user exists and has a role
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this resource'
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
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
  console.log('Authorization header:', req.headers.authorization ? `${req.headers.authorization.substring(0, 15)}...` : 'none');
  console.log('Cookies:', req.cookies ? JSON.stringify(req.cookies) : 'none');
  
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
    console.log('Token extracted from Authorization header');
  } else if (req.cookies && req.cookies.token) {
    // Set token from cookie
    token = req.cookies.token;
    console.log('Token extracted from cookie');
  }

  // Make sure token exists
  if (!token) {
    console.log('No token found in request');
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    console.log('Verifying JWT token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token verified, user id:', decoded.id);

    req.user = await User.findById(decoded.id);
    
    if (!req.user) {
      console.log('User not found in database with id:', decoded.id);
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log('User found:', req.user._id);
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
      details: err.message
    });
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      console.log('User not found in request object');
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this route'
      });
    }
    
    console.log(`Checking if user role '${req.user.role}' is in allowed roles:`, roles);
    
    if (!roles.includes(req.user.role)) {
      console.log('User role not authorized');
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    
    console.log('User role authorized');
    next();
  };
}; 
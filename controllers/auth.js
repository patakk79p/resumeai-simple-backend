const User = require('../models/User');

// @desc    Register user
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    console.log('Register request received:', JSON.stringify(req.body, null, 2));
    
    // Validate request body
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      console.log('Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Please provide name, email and password'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists with email:', email);
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
    sendTokenResponse(user, 201, res);
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(400).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    console.log('Login request received:', JSON.stringify({
      email: req.body.email,
      passwordProvided: !!req.body.password
    }, null, 2));
    
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Please provide an email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('No user found with email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log('User found:', user._id);
    
    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      console.log('Password does not match for user:', user._id);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    console.log('Password matched, login successful');
    sendTokenResponse(user, 200, res);
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};

// @desc    Log user out / clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = (req, res) => {
  console.log('Logout request received');
  
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
};

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    console.log('Get me request for user:', req.user.id);
    
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// @desc    Test auth route
// @route   GET /api/v1/auth/test
// @access  Public
exports.testAuth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth routes are working',
    timestamp: new Date().toISOString()
  });
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();
  
  console.log('Generated JWT token for user:', user._id);

  // Setup cookie options
  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    sameSite: 'None',  // Allow cross-site cookies
    secure: true,      // Cookies only sent over HTTPS
    path: '/'
  };

  // In development, allow non-secure cookies for testing
  if (process.env.NODE_ENV === 'development') {
    options.secure = false;
  }

  console.log('Setting cookie with options:', JSON.stringify({
    ...options,
    expires: options.expires.toISOString()
  }));

  // Always send the token in the response body 
  // This allows the frontend to store it in localStorage as a fallback
  const responseData = {
    success: true,
    token,
    tokenExpires: options.expires,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };

  console.log('Sending response with token and user data');
  
  // Remove direct CORS header setting - let the middleware handle it
  
  // Send cookie and JSON response
  res
    .status(statusCode)
    .cookie('token', token, options)
    .json(responseData);
}; 
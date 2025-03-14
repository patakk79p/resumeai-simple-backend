const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const colors = require('colors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// Load env vars
dotenv.config({ path: './config/config.env' });

// Create Express app
const app = express();

// Port
const PORT = process.env.PORT || 8000;

// IMPORTANT: THIS IS THE CRITICAL CORS FIX
// Handle all OPTIONS requests first, before any other middleware
app.options('*', (req, res) => {
  console.log('Handling OPTIONS preflight request for:', req.originalUrl);
  res.set({
    'Access-Control-Allow-Origin': 'https://resumeaisite.onrender.com',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400' // 24 hours
  }).status(200).end();
});

// Apply Access-Control headers to ALL responses
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': 'https://resumeaisite.onrender.com',
    'Access-Control-Allow-Credentials': 'true'
  });
  next();
});

// Connect to database
connectDB()
  .then(() => {
    console.log('MongoDB connection successful'.green.bold);
  })
  .catch(err => {
    console.error(`MongoDB connection error: ${err.message}`.red.bold);
    // Continue running the app even if DB connection fails
  });

// Log MongoDB connection state periodically
setInterval(() => {
  const state = mongoose.connection.readyState;
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  console.log(`MongoDB connection state: ${states[state]}`.cyan);
}, 60000); // Log every minute

// Route files
const auth = require('./routes/auth');

// Basic middleware
app.use(express.json());
app.use(cookieParser());

// Simplified CORS setup
app.use(cors({
  origin: 'https://resumeaisite.onrender.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  maxAge: 86400 // 24 hours
}));

// Serve static files from the public directory
app.use(express.static('public'));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`.blue);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  next();
});

// Simple health check route
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  res.status(200).json({ 
    status: 'ok', 
    message: 'API is running',
    database: {
      status: dbStates[dbState],
      connected: dbState === 1
    },
    environment: process.env.NODE_ENV
  });
});

// No-CORS test route
app.get('/api/no-cors-test', (req, res) => {
  // This route should work even without CORS
  res.json({ message: 'This endpoint works without requiring CORS' });
});

// CORS test route with explicit headers
app.get('/api/cors-test', (req, res) => {
  res.header('Access-Control-Allow-Origin', 'https://resumeaisite.onrender.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  res.json({ 
    message: 'CORS test successful',
    receivedOrigin: req.headers.origin || 'No origin in request',
    receivedHeaders: req.headers,
    sentHeaders: res.getHeaders()
  });
});

// Frontend connection help route
app.get('/api/frontend-help', (req, res) => {
  res.status(200).json({
    message: "Connection information for frontend integration",
    serverUrl: req.protocol + '://' + req.get('host'),
    corsAllowedOrigins: ['https://resumeaisite.onrender.com'],
    requestOrigin: req.headers.origin || 'No origin header',
    currentTime: new Date().toISOString(),
    instructions: [
      "1. Make sure your frontend API base URL is set to: " + req.protocol + '://' + req.get('host'),
      "2. Add credentials: 'include' to all fetch/axios requests",
      "3. Include Content-Type: application/json header for POST/PUT requests",
      "4. Try using local storage for the token as a fallback if cookies don't work"
    ],
    exampleCode: {
      fetch: `
fetch('${req.protocol + '://' + req.get('host')}/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    name: 'Test User',
    email: 'test@example.com',
    password: 'password123'
  })
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));
      `,
      axios: `
import axios from 'axios';

// Configure axios
axios.defaults.baseURL = '${req.protocol + '://' + req.get('host')}';
axios.defaults.withCredentials = true;
axios.defaults.headers.post['Content-Type'] = 'application/json';

// Example register request
const register = async (userData) => {
  try {
    const response = await axios.post('/api/v1/auth/register', userData);
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};
      `
    }
  });
});

// Debug route to check environment variables (sanitized)
app.get('/api/debug', (req, res) => {
  res.status(200).json({
    environment: process.env.NODE_ENV,
    clientUrl: process.env.CLIENT_URL,
    port: process.env.PORT,
    mongoConnected: mongoose.connection.readyState === 1,
    hasJwtSecret: !!process.env.JWT_SECRET
  });
});

// Middleware for wrapping routes with CORS headers
const withCors = (handler) => {
  return (req, res, next) => {
    res.set({
      'Access-Control-Allow-Origin': 'https://resumeaisite.onrender.com',
      'Access-Control-Allow-Credentials': 'true'
    });
    handler(req, res, next);
  };
};

// Mount routers with CORS wrapper
app.use('/api/v1/auth', (req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': 'https://resumeaisite.onrender.com',
    'Access-Control-Allow-Credentials': 'true'
  });
  auth(req, res, next);
});

// Handle 404 errors
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`.yellow.bold);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`.red);
  // Close server & exit process
  server.close(() => process.exit(1));
}); 
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

// Middleware
app.use(express.json());
app.use(cookieParser());

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Add options handling for preflight requests
app.options('*', cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`.blue);
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

// Mount routers
app.use('/api/v1/auth', auth);

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
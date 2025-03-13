const express = require('express');
const cors = require('cors');

// Create Express app
const app = express();

// Port
const PORT = process.env.PORT || 8000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Simple health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API is running' });
});

// Simple authentication routes
app.post('/api/v1/auth/register', (req, res) => {
  // Mock response
  res.status(201).json({
    success: true,
    data: {
      _id: '12345',
      name: req.body.name || 'Test User',
      email: req.body.email || 'test@example.com',
      role: 'user'
    }
  });
});

app.post('/api/v1/auth/login', (req, res) => {
  // Mock response
  res.status(200).json({
    success: true,
    data: {
      _id: '12345',
      name: 'Test User',
      email: req.body.email || 'test@example.com',
      role: 'user'
    }
  });
});

app.get('/api/v1/auth/logout', (req, res) => {
  res.status(200).json({
    success: true,
    data: {}
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  // Mock response
  res.status(200).json({
    success: true,
    data: {
      _id: '12345',
      name: 'Test User',
      email: 'test@example.com',
      role: 'user'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
/**
 * ResumeAI Backend Deployment Script
 * 
 * This script performs pre-deployment checks and tasks for deploying
 * the ResumeAI backend to production environments.
 * 
 * Usage:
 * node scripts/deploy.js [environment]
 * 
 * Environment options:
 * - development (default)
 * - staging
 * - production
 * 
 * Features:
 * - Validates environment variables
 * - Tests critical authentication flows
 * - Cleans up expired tokens
 * - Generates deployment report
 */

require('dotenv').config({ path: './config/config.env' });
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const axios = require('axios');
const colors = require('colors');
const { spawnSync } = require('child_process');

// Import models and utilities
const Token = require('../models/Token');
const User = require('../models/User');
const tokenUtils = require('../utils/tokenUtils');

// Configuration
const API_ENDPOINTS = {
  development: 'http://localhost:8000/api/v1',
  staging: 'https://staging-resumeai-backend.onrender.com/api/v1',
  production: 'https://resumeai-simple-backend.onrender.com/api/v1'
};

// Initialize variables
let environment = process.argv[2] || 'development';
let apiBaseUrl = API_ENDPOINTS[environment];
let exitCode = 0;
let testResults = [];
let warnings = [];

// Logger
const logger = {
  info: (msg) => console.log('ℹ️  '.blue + msg),
  success: (msg) => console.log('✅ '.green + msg),
  warning: (msg) => {
    console.log('⚠️  '.yellow + msg);
    warnings.push(msg);
  },
  error: (msg, err) => {
    console.error('❌ '.red + msg);
    if (err) {
      if (err.response) {
        console.error('  Status:'.yellow, err.response.status);
        console.error('  Data:'.yellow, JSON.stringify(err.response.data, null, 2));
      } else if (err.message) {
        console.error('  Error:'.yellow, err.message);
      } else {
        console.error('  Error:'.yellow, err);
      }
    }
    exitCode = 1;
  },
  header: (msg) => console.log('\n' + '='.repeat(50).cyan + '\n' + msg.cyan.bold + '\n' + '='.repeat(50).cyan)
};

// Print startup information
logger.header(`DEPLOYMENT SCRIPT - ${environment.toUpperCase()} ENVIRONMENT`);
logger.info(`API URL: ${apiBaseUrl}`);
logger.info(`MongoDB URI: ${process.env.MONGO_URI.substring(0, 25)}...`);

// Validate environment setup
async function validateEnvironment() {
  logger.header('VALIDATING ENVIRONMENT');
  
  // Check if environment is valid
  if (!API_ENDPOINTS[environment]) {
    logger.error(`Invalid environment: ${environment}`);
    logger.info('Valid environments: development, staging, production');
    process.exit(1);
  }
  
  // Check required environment variables
  const requiredVars = [
    'NODE_ENV', 'PORT', 'MONGO_URI', 'JWT_SECRET', 
    'JWT_ACCESS_EXPIRE', 'JWT_REFRESH_EXPIRE_DAYS'
  ];
  
  let missingVars = [];
  
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    logger.error(`Missing environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  // Check JWT secret strength
  if (process.env.JWT_SECRET.length < 32) {
    logger.warning('JWT_SECRET is less than 32 characters long. This is a security risk.');
  }
  
  // Check for MongoDB connection
  try {
    logger.info('Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGO_URI);
    
    logger.success('MongoDB connection successful');
    
    // Count users in the database
    const userCount = await User.countDocuments();
    logger.info(`Database contains ${userCount} users`);
    
    // Count tokens in the database
    const tokenCount = await Token.countDocuments();
    logger.info(`Database contains ${tokenCount} tokens`);
    
    // Check for expired tokens
    const expiredTokens = await Token.countDocuments({
      expiresAt: { $lt: new Date() },
      isRevoked: false
    });
    
    if (expiredTokens > 0) {
      logger.warning(`Found ${expiredTokens} expired tokens that have not been revoked`);
    }
    
    return true;
  } catch (err) {
    logger.error('MongoDB connection failed', err);
    return false;
  }
}

// Test authentication endpoints
async function testAuth() {
  logger.header('TESTING AUTHENTICATION ENDPOINTS');
  
  // Set up axios instance
  const api = axios.create({
    baseURL: apiBaseUrl,
    validateStatus: null // don't throw on non-2xx status
  });
  
  // Generate a unique test user
  const testUser = {
    name: 'Deployment Test User',
    email: `deploy_test_${Date.now()}@example.com`,
    password: 'Deploy!Test123'
  };
  
  // Test data
  const tests = [
    {
      name: 'Test Auth Endpoint',
      run: async () => {
        const res = await api.get('/auth/test');
        return { 
          success: res.status === 200 && res.data.success === true,
          details: res.data
        };
      }
    },
    {
      name: 'User Registration',
      run: async () => {
        const res = await api.post('/auth/register', testUser);
        if (res.status === 201 && res.data.success) {
          // Store tokens for subsequent tests
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        }
        return { 
          success: res.status === 201 && res.data.success === true,
          details: { 
            status: res.status, 
            user: res.data.user ? res.data.user._id : null 
          }
        };
      }
    },
    {
      name: 'Get Current User',
      run: async () => {
        const res = await api.get('/auth/me');
        return { 
          success: res.status === 200 && res.data.success === true,
          details: { name: res.data.data ? res.data.data.name : null }
        };
      }
    },
    {
      name: 'Logout',
      run: async () => {
        const res = await api.get('/auth/logout');
        return { 
          success: res.status === 200 && res.data.success === true,
          details: res.data
        };
      }
    },
    {
      name: 'Login',
      run: async () => {
        const res = await api.post('/auth/login', {
          email: testUser.email,
          password: testUser.password
        });
        
        if (res.status === 200 && res.data.success) {
          // Update token for subsequent tests
          api.defaults.headers.common['Authorization'] = `Bearer ${res.data.accessToken}`;
        }
        
        return { 
          success: res.status === 200 && res.data.success === true,
          details: { 
            status: res.status, 
            user: res.data.user ? res.data.user._id : null 
          }
        };
      }
    }
  ];
  
  // Run tests
  for (const test of tests) {
    logger.info(`Running test: ${test.name}`);
    
    try {
      const result = await test.run();
      
      if (result.success) {
        logger.success(`${test.name}: PASSED`);
        testResults.push({ name: test.name, passed: true, details: result.details });
      } else {
        logger.error(`${test.name}: FAILED`, { response: { data: result.details } });
        testResults.push({ name: test.name, passed: false, details: result.details });
      }
    } catch (err) {
      logger.error(`${test.name}: ERROR`, err);
      testResults.push({ name: test.name, passed: false, error: err.message });
    }
  }
  
  // Clean up test user if possible
  try {
    if (mongoose.connection.readyState === 1) { // Connected
      const user = await User.findOne({ email: testUser.email });
      if (user) {
        await User.deleteOne({ _id: user._id });
        await Token.deleteMany({ user: user._id });
        logger.info(`Test user and tokens removed from database`);
      }
    }
  } catch (err) {
    logger.warning(`Could not clean up test user: ${err.message}`);
  }
  
  // Calculate test results
  const passedTests = testResults.filter(t => t.passed).length;
  const totalTests = testResults.length;
  
  logger.info(`Test Results: ${passedTests}/${totalTests} tests passed`);
  
  return passedTests === totalTests;
}

// Clean up expired tokens
async function cleanupTokens() {
  logger.header('CLEANING UP EXPIRED TOKENS');
  
  try {
    // Only run if connected to MongoDB
    if (mongoose.connection.readyState !== 1) {
      logger.warning('Not connected to MongoDB, skipping token cleanup');
      return false;
    }
    
    logger.info('Finding and marking expired tokens as revoked...');
    
    const count = await tokenUtils.cleanupExpiredTokens();
    
    logger.success(`Successfully marked ${count} expired tokens as revoked`);
    return true;
  } catch (err) {
    logger.error('Token cleanup failed', err);
    return false;
  }
}

// Generate deployment report
function generateReport() {
  logger.header('GENERATING DEPLOYMENT REPORT');
  
  const now = new Date();
  const report = {
    timestamp: now.toISOString(),
    environment,
    apiUrl: apiBaseUrl,
    testResults,
    warnings,
    exitCode
  };
  
  // Create reports directory if it doesn't exist
  const reportsDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir);
  }
  
  // Write report to file
  const reportPath = path.join(
    reportsDir,
    `deploy-${environment}-${now.toISOString().replace(/:/g, '-')}.json`
  );
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  logger.success(`Deployment report saved to ${reportPath}`);
  
  // Print summary
  logger.header('DEPLOYMENT SUMMARY');
  logger.info(`Environment: ${environment}`);
  logger.info(`API URL: ${apiBaseUrl}`);
  
  const passedTests = testResults.filter(t => t.passed).length;
  logger.info(`Tests: ${passedTests}/${testResults.length} passed`);
  
  if (warnings.length > 0) {
    logger.info(`Warnings: ${warnings.length}`);
    warnings.forEach(warning => logger.warning(warning));
  }
  
  if (exitCode === 0) {
    logger.success('Deployment checks completed successfully');
  } else {
    logger.error('Deployment checks failed');
  }
  
  return reportPath;
}

// Run the deployment steps
async function runDeployment() {
  try {
    // Validate environment
    const envValid = await validateEnvironment();
    if (!envValid) {
      exitCode = 1;
    }
    
    // Test authentication
    const authTestsPassed = await testAuth();
    if (!authTestsPassed) {
      exitCode = 1;
    }
    
    // Clean up tokens
    await cleanupTokens();
    
    // Generate report
    const reportPath = generateReport();
    
    // Close mongoose connection
    await mongoose.connection.close();
    
    // Exit with appropriate code
    process.exit(exitCode);
  } catch (err) {
    logger.error('Deployment script failed', err);
    process.exit(1);
  }
}

// Start the deployment process
runDeployment(); 
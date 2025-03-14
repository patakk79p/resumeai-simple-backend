/**
 * Test Authentication System
 * 
 * This script tests the authentication system by simulating the registration,
 * login, token refresh, and logout flows.
 * 
 * Usage: 
 * node scripts/test-auth.js
 */

const axios = require('axios');
const colors = require('colors');

// Test configuration
const API_URL = 'http://localhost:8000/api/v1';
const TEST_USER = {
  name: 'Test User',
  email: `test${Date.now()}@example.com`,
  password: 'password123'
};

let accessToken = null;
let refreshToken = null;

// Helper function to log success/error messages
const log = {
  info: (msg) => console.log('ℹ️  '.blue + msg),
  success: (msg) => console.log('✅ '.green + msg),
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
  },
  header: (msg) => console.log('\n' + '='.repeat(50).cyan + '\n' + msg.cyan.bold + '\n' + '='.repeat(50).cyan)
};

// Set up axios instance with authorization header
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true
});

// Interceptor to add token
api.interceptors.request.use(
  config => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Test registration flow
async function testRegistration() {
  log.header('Testing User Registration');
  
  try {
    log.info(`Registering user with email: ${TEST_USER.email}`);
    
    const res = await api.post('/auth/register', TEST_USER);
    
    accessToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
    
    log.success('User registered successfully!');
    log.info(`User ID: ${res.data.user._id}`);
    log.info(`Access Token: ${accessToken.substring(0, 20)}...`);
    log.info(`Refresh Token: ${refreshToken.substring(0, 20)}...`);
    
    return true;
  } catch (err) {
    log.error('Registration failed', err);
    return false;
  }
}

// Test login flow
async function testLogin() {
  log.header('Testing User Login');
  
  try {
    log.info(`Logging in with email: ${TEST_USER.email}`);
    
    const res = await api.post('/auth/login', {
      email: TEST_USER.email,
      password: TEST_USER.password
    });
    
    accessToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
    
    log.success('Login successful!');
    log.info(`Access Token: ${accessToken.substring(0, 20)}...`);
    log.info(`Refresh Token: ${refreshToken.substring(0, 20)}...`);
    
    return true;
  } catch (err) {
    log.error('Login failed', err);
    return false;
  }
}

// Test getMe endpoint (authenticated)
async function testGetMe() {
  log.header('Testing Get Current User');
  
  try {
    log.info('Fetching current user information');
    
    const res = await api.get('/auth/me');
    
    log.success('Successfully retrieved user information!');
    log.info(`User: ${JSON.stringify(res.data.data, null, 2)}`);
    
    return true;
  } catch (err) {
    log.error('Failed to get user information', err);
    return false;
  }
}

// Test token refresh
async function testRefreshToken() {
  log.header('Testing Token Refresh');
  
  try {
    log.info('Requesting new access token using refresh token');
    
    // Clear access token to simulate expiration
    const oldAccessToken = accessToken;
    accessToken = null;
    
    const res = await api.post('/auth/refresh-token', { refreshToken });
    
    accessToken = res.data.accessToken;
    refreshToken = res.data.refreshToken;
    
    log.success('Token refresh successful!');
    log.info(`Old Access Token: ${oldAccessToken.substring(0, 20)}...`);
    log.info(`New Access Token: ${accessToken.substring(0, 20)}...`);
    log.info(`New Refresh Token: ${refreshToken.substring(0, 20)}...`);
    
    return true;
  } catch (err) {
    log.error('Token refresh failed', err);
    return false;
  }
}

// Test reuse detection
async function testTokenReuseDetection() {
  log.header('Testing Token Reuse Detection');
  
  try {
    log.info('Testing reuse of the same refresh token (should fail)');
    
    // Store the current refresh token
    const oldRefreshToken = refreshToken;
    
    // First refresh should work
    log.info('First refresh (should succeed)');
    const res1 = await api.post('/auth/refresh-token', { refreshToken: oldRefreshToken });
    
    // Update tokens from first refresh
    accessToken = res1.data.accessToken;
    refreshToken = res1.data.refreshToken;
    
    log.success('First token refresh successful!');
    
    try {
      // Second refresh with same token should fail
      log.info('Second refresh with same token (should fail)');
      await api.post('/auth/refresh-token', { refreshToken: oldRefreshToken });
      
      log.error('Token reuse was allowed! This is a security issue.');
      return false;
    } catch (err) {
      if (err.response && err.response.status === 401) {
        log.success('Token reuse was correctly detected and blocked!');
        // Get new tokens since the whole family was likely revoked
        await testLogin();
        return true;
      } else {
        log.error('Token reuse test failed for an unexpected reason', err);
        return false;
      }
    }
  } catch (err) {
    log.error('Token reuse detection test failed', err);
    return false;
  }
}

// Test logout
async function testLogout() {
  log.header('Testing User Logout');
  
  try {
    log.info('Logging out user');
    
    const res = await api.get('/auth/logout');
    
    log.success('Logout successful!');
    log.info(`Message: ${res.data.message}`);
    
    // Clear tokens
    accessToken = null;
    refreshToken = null;
    
    return true;
  } catch (err) {
    log.error('Logout failed', err);
    return false;
  }
}

// Test unauthenticated access after logout
async function testUnauthenticatedAccess() {
  log.header('Testing Unauthenticated Access');
  
  try {
    log.info('Attempting to access protected resource after logout');
    
    await api.get('/auth/me');
    
    log.error('Unauthenticated access was allowed! This is a security issue.');
    return false;
  } catch (err) {
    if (err.response && err.response.status === 401) {
      log.success('Protected resource correctly blocked unauthenticated access!');
      return true;
    } else {
      log.error('Unauthenticated access test failed for an unexpected reason', err);
      return false;
    }
  }
}

// Main test function
async function runTests() {
  log.header('AUTHENTICATION SYSTEM TEST');
  
  let results = [];
  
  // Registration
  results.push({ test: 'Registration', passed: await testRegistration() });
  
  // Get Me (after registration)
  results.push({ test: 'Get User Info', passed: await testGetMe() });
  
  // Refresh Token
  results.push({ test: 'Refresh Token', passed: await testRefreshToken() });
  
  // Token Reuse Detection
  results.push({ test: 'Token Reuse Detection', passed: await testTokenReuseDetection() });
  
  // Logout
  results.push({ test: 'Logout', passed: await testLogout() });
  
  // Unauthenticated Access
  results.push({ test: 'Unauthenticated Access', passed: await testUnauthenticatedAccess() });
  
  // Login
  results.push({ test: 'Login', passed: await testLogin() });
  
  // Summary
  log.header('TEST RESULTS');
  
  let totalTests = results.length;
  let passedTests = results.filter(r => r.passed).length;
  
  console.log('Test Results:');
  results.forEach(result => {
    const status = result.passed 
      ? '✅ PASS'.green 
      : '❌ FAIL'.red;
    console.log(`${status} - ${result.test}`);
  });
  
  console.log('\nSummary:');
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  const overallResult = passedTests === totalTests
    ? 'AUTH SYSTEM TEST: ✅ ALL TESTS PASSED'.green.bold
    : 'AUTH SYSTEM TEST: ❌ SOME TESTS FAILED'.red.bold;
  
  console.log('\n' + overallResult);
}

// Run the tests
runTests().catch(err => {
  console.error('Test script error:', err);
}); 
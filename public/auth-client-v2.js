/**
 * ResumeAI Auth Client v2
 * 
 * A modern authentication client for the ResumeAI API with JWT token handling,
 * automatic token refresh, and secure localStorage fallback.
 * 
 * Features:
 * - Token-based authentication
 * - Automatic token refresh
 * - LocalStorage fallback for when cookies don't work
 * - Token security
 * - Logout functionality
 * - User information retrieval
 */

(function (window) {
  'use strict';

  // Default configuration
  const defaultConfig = {
    apiUrl: 'https://resumeai-simple-backend.onrender.com/api/v1',
    tokenRefreshThreshold: 5 * 60, // Refresh token 5 minutes before expiry
    localStorageKeys: {
      accessToken: 'resumeai_access_token',
      refreshToken: 'resumeai_refresh_token',
      tokenExpiry: 'resumeai_token_expiry',
      user: 'resumeai_user'
    }
  };

  // Utility functions
  const utils = {
    // Parse JWT token to get expiry time
    parseJwt: function(token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        return JSON.parse(jsonPayload);
      } catch (e) {
        console.error('Error parsing JWT token:', e);
        return null;
      }
    },

    // Store data in localStorage
    store: function(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.error('Error storing data in localStorage:', e);
      }
    },

    // Retrieve data from localStorage
    retrieve: function(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        console.error('Error retrieving data from localStorage:', e);
        return null;
      }
    },

    // Remove data from localStorage
    remove: function(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error('Error removing data from localStorage:', e);
      }
    },

    // Handle HTTP request with fetch
    request: async function(url, method = 'GET', body = null, headers = {}, includeAuth = true) {
      try {
        // Prepare request options
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          credentials: 'include', // Include cookies
        };

        // Include authentication token if required
        if (includeAuth) {
          const accessToken = utils.retrieve(config.localStorageKeys.accessToken);
          if (accessToken) {
            options.headers['Authorization'] = `Bearer ${accessToken}`;
          }
        }

        // Include body for POST/PUT requests
        if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
        }

        // Make the request
        const response = await fetch(url, options);
        
        // Handle response
        const data = await response.json();
        
        if (!response.ok) {
          // Check if token expired
          if (response.status === 401 && data.isExpired) {
            // Try to refresh the token
            if (await authClient.refreshToken()) {
              // Retry the request with the new token
              return await utils.request(url, method, body, headers, includeAuth);
            }
          }
          
          throw new Error(data.error || 'Request failed');
        }
        
        return data;
      } catch (e) {
        console.error('API request error:', e);
        throw e;
      }
    }
  };

  // Store the config
  let config = { ...defaultConfig };

  // Auth client implementation
  const authClient = {
    // Update default configuration
    configure: function(newConfig) {
      config = { ...config, ...newConfig };
      return this;
    },

    // Register a new user
    register: async function(userData) {
      try {
        const result = await utils.request(
          `${config.apiUrl}/auth/register`,
          'POST',
          userData,
          {},
          false // Don't include auth for registration
        );

        if (result.success) {
          // Store tokens and user info
          this._storeAuthData(result);
          return { success: true, user: result.user };
        } else {
          throw new Error(result.error || 'Registration failed');
        }
      } catch (error) {
        console.error('Registration error:', error);
        return { success: false, error: error.message };
      }
    },

    // Log in a user
    login: async function(email, password) {
      try {
        const result = await utils.request(
          `${config.apiUrl}/auth/login`,
          'POST',
          { email, password },
          {},
          false // Don't include auth for login
        );

        if (result.success) {
          // Store tokens and user info
          this._storeAuthData(result);
          return { success: true, user: result.user };
        } else {
          throw new Error(result.error || 'Login failed');
        }
      } catch (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
      }
    },

    // Refresh access token using refresh token
    refreshToken: async function() {
      try {
        // Get refresh token from localStorage
        const refreshToken = utils.retrieve(config.localStorageKeys.refreshToken);
        
        if (!refreshToken) {
          console.error('No refresh token available');
          return false;
        }

        // Request new tokens
        const result = await fetch(`${config.apiUrl}/auth/refresh-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ refreshToken }),
          credentials: 'include'
        }).then(res => res.json());

        if (result.success) {
          // Store new tokens
          this._storeAuthData(result);
          return true;
        } else {
          // Handle token refresh failure
          console.error('Token refresh failed:', result.error);
          
          // If security breach detected, logout
          if (result.isSecurityBreach) {
            console.warn('Security breach detected. Logging out...');
            this.logout();
          }
          
          return false;
        }
      } catch (error) {
        console.error('Token refresh error:', error);
        return false;
      }
    },

    // Log out the current user
    logout: async function() {
      try {
        // Call the logout endpoint if user is logged in
        if (this.isAuthenticated()) {
          await utils.request(`${config.apiUrl}/auth/logout`, 'GET');
        }
      } catch (error) {
        console.error('Logout error:', error);
      } finally {
        // Clear stored tokens and user info
        this._clearAuthData();
      }
    },

    // Log out from all devices
    logoutAll: async function() {
      try {
        // Call the logout-all endpoint if user is logged in
        if (this.isAuthenticated()) {
          await utils.request(`${config.apiUrl}/auth/logout-all`, 'POST');
        }
      } catch (error) {
        console.error('Logout all error:', error);
      } finally {
        // Clear stored tokens and user info
        this._clearAuthData();
      }
    },

    // Get the current authenticated user
    getCurrentUser: async function() {
      try {
        // Check if user is authenticated
        if (!this.isAuthenticated()) {
          return null;
        }

        // Get user from localStorage first
        const storedUser = utils.retrieve(config.localStorageKeys.user);
        
        // If token is about to expire, refresh it
        await this._checkTokenExpiry();

        // Get the user from the API
        const result = await utils.request(`${config.apiUrl}/auth/me`, 'GET');
        
        if (result.success) {
          // Update stored user info
          utils.store(config.localStorageKeys.user, result.data);
          return result.data;
        } else {
          throw new Error(result.error || 'Failed to get user information');
        }
      } catch (error) {
        console.error('Get current user error:', error);
        
        // If stored user exists, return it as fallback
        const storedUser = utils.retrieve(config.localStorageKeys.user);
        return storedUser;
      }
    },

    // Check if user is authenticated
    isAuthenticated: function() {
      const token = utils.retrieve(config.localStorageKeys.accessToken);
      const tokenExpiry = utils.retrieve(config.localStorageKeys.tokenExpiry);
      
      // Check if token exists and is not expired
      return !!token && tokenExpiry && new Date(tokenExpiry) > new Date();
    },

    // Get access token
    getToken: function() {
      return utils.retrieve(config.localStorageKeys.accessToken);
    },

    // Make an authenticated API request
    apiRequest: async function(endpoint, method = 'GET', body = null, headers = {}) {
      try {
        // Check if token is about to expire and refresh if needed
        await this._checkTokenExpiry();
        
        // Make the request
        const url = `${config.apiUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
        return await utils.request(url, method, body, headers);
      } catch (error) {
        console.error('API request error:', error);
        throw error;
      }
    },

    // Private: Store authentication data
    _storeAuthData: function(data) {
      // Store tokens
      utils.store(config.localStorageKeys.accessToken, data.accessToken);
      utils.store(config.localStorageKeys.refreshToken, data.refreshToken);
      
      // Parse token to get expiry
      const tokenData = utils.parseJwt(data.accessToken);
      if (tokenData && tokenData.exp) {
        const expiry = new Date(tokenData.exp * 1000);
        utils.store(config.localStorageKeys.tokenExpiry, expiry);
      }
      
      // Store user info
      if (data.user) {
        utils.store(config.localStorageKeys.user, data.user);
      }
    },

    // Private: Clear authentication data
    _clearAuthData: function() {
      utils.remove(config.localStorageKeys.accessToken);
      utils.remove(config.localStorageKeys.refreshToken);
      utils.remove(config.localStorageKeys.tokenExpiry);
      utils.remove(config.localStorageKeys.user);
    },

    // Private: Check if token is about to expire and refresh if needed
    _checkTokenExpiry: async function() {
      try {
        const tokenExpiry = utils.retrieve(config.localStorageKeys.tokenExpiry);
        if (!tokenExpiry) return false;
        
        const expiryDate = new Date(tokenExpiry);
        const now = new Date();
        
        // If token will expire soon, refresh it
        if ((expiryDate - now) / 1000 < config.tokenRefreshThreshold) {
          console.log('Token expiring soon, refreshing...');
          return await this.refreshToken();
        }
        
        return true;
      } catch (error) {
        console.error('Token expiry check error:', error);
        return false;
      }
    }
  };

  // Expose the auth client globally
  window.ResumeAIAuth = authClient;

})(window); 
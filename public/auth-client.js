/**
 * ResumeAI Authentication Client Utility
 * 
 * This file provides authentication utilities for the frontend
 * to interact with the ResumeAI backend.
 */

// Set this to your backend URL
const API_URL = 'https://resumeai-simple-backend.onrender.com';

// Authentication utilities
const ResumeAIAuth = {
  /**
   * Register a new user
   * @param {Object} userData - User data (name, email, password)
   * @returns {Promise} - Promise with user data
   */
  register: async (userData) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // For cookies
        body: JSON.stringify(userData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }
      
      const data = await response.json();
      
      // Store token in localStorage as a fallback
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.data));
      
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },
  
  /**
   * Login user
   * @param {Object} credentials - User credentials (email, password)
   * @returns {Promise} - Promise with user data
   */
  login: async (credentials) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // For cookies
        body: JSON.stringify(credentials)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }
      
      const data = await response.json();
      
      // Store token in localStorage as a fallback
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.data));
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  /**
   * Logout user
   * @returns {Promise} - Promise that resolves when logout is complete
   */
  logout: async () => {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'GET',
        credentials: 'include', // For cookies
      });
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      
      // Still clear localStorage even if the server request fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      return true;
    }
  },
  
  /**
   * Get current user
   * @returns {Promise} - Promise with user data
   */
  getCurrentUser: async () => {
    try {
      // Try to get user from localStorage first (fallback)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      
      // Get token from localStorage (fallback if cookie doesn't work)
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        credentials: 'include', // For cookies
      });
      
      if (!response.ok) {
        throw new Error('Failed to get current user');
      }
      
      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  },
  
  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} - Promise that resolves to true if authenticated
   */
  isAuthenticated: async () => {
    const user = await ResumeAIAuth.getCurrentUser();
    return !!user;
  },
  
  /**
   * Get authentication token (for use in headers)
   * @returns {string|null} - Token or null if not authenticated
   */
  getToken: () => {
    return localStorage.getItem('token');
  }
};

// Make available globally if in browser
if (typeof window !== 'undefined') {
  window.ResumeAIAuth = ResumeAIAuth;
} 
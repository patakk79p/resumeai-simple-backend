/**
 * ResumeAI Authentication Client Utility (Axios version)
 * 
 * This file provides authentication utilities for the frontend
 * to interact with the ResumeAI backend using Axios.
 */

// Import axios if using as a module
// const axios = require('axios'); // CommonJS
// import axios from 'axios'; // ES modules

// Set this to your backend URL
const API_URL = 'https://resumeai-simple-backend.onrender.com';

// Configure axios
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add interceptor to include token in requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Authentication utilities
const ResumeAIAuthAxios = {
  /**
   * Register a new user
   * @param {Object} userData - User data (name, email, password)
   * @returns {Promise} - Promise with user data
   */
  register: async (userData) => {
    try {
      const response = await api.post('/api/v1/auth/register', userData);
      
      // Store token in localStorage as a fallback
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data));
      
      return response.data;
    } catch (error) {
      console.error('Registration error:', error.response?.data || error.message);
      throw error.response?.data?.error || error.message;
    }
  },
  
  /**
   * Login user
   * @param {Object} credentials - User credentials (email, password)
   * @returns {Promise} - Promise with user data
   */
  login: async (credentials) => {
    try {
      const response = await api.post('/api/v1/auth/login', credentials);
      
      // Store token in localStorage as a fallback
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.data));
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error.response?.data?.error || error.message;
    }
  },
  
  /**
   * Logout user
   * @returns {Promise} - Promise that resolves when logout is complete
   */
  logout: async () => {
    try {
      await api.get('/api/v1/auth/logout');
      
      // Clear localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      return true;
    } catch (error) {
      console.error('Logout error:', error.response?.data || error.message);
      
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
      
      const response = await api.get('/api/v1/auth/me');
      return response.data.data;
    } catch (error) {
      console.error('Get current user error:', error.response?.data || error.message);
      return null;
    }
  },
  
  /**
   * Check if user is authenticated
   * @returns {Promise<boolean>} - Promise that resolves to true if authenticated
   */
  isAuthenticated: async () => {
    const user = await ResumeAIAuthAxios.getCurrentUser();
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
  window.ResumeAIAuthAxios = ResumeAIAuthAxios;
} 
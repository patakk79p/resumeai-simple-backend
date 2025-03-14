# ResumeAI Frontend Integration Guide

This guide explains how to integrate the ResumeAI authentication system with your React frontend application.

## Overview

The ResumeAI backend implements a secure authentication system with:

- JWT-based authentication
- Refresh token rotation
- Protection against token reuse attacks
- CORS support for cross-domain requests

## Authentication Flow

![Authentication Flow](https://www.plantuml.com/plantuml/proxy?cache=no&src=https://raw.githubusercontent.com/your-repo/auth-flow.puml)

1. User logs in with credentials
2. Backend validates credentials and generates tokens
3. Access token (JWT) is used for API requests
4. When access token expires, refresh token is used to get a new access token
5. Tokens are automatically refreshed when needed

## Integration Options

There are two main ways to integrate with the authentication system:

### Option 1: Use the Authentication Client

We provide a pre-built client library (`auth-client-v2.js`) that handles all authentication functionality:

1. Download the [auth-client-v2.js](https://resumeai-simple-backend.onrender.com/auth-client-v2.js) file
2. Include it in your React application
3. Use the client APIs to handle authentication

### Option 2: Build Your Own Integration

If you prefer to build your own integration, you can use the API directly:

1. Implement the authentication flows using fetch or axios
2. Handle token storage and refresh logic yourself
3. Build your own error handling and UI integration

## Option 1: Using the Authentication Client

### Step 1: Install the Authentication Client

Place the `auth-client-v2.js` file in your project's `public` directory:

```
public/
  └── auth-client-v2.js
```

Then import it in your HTML file (`public/index.html`):

```html
<script src="%PUBLIC_URL%/auth-client-v2.js"></script>
```

### Step 2: Create an Authentication Context

Create a React context to manage authentication state:

```jsx
// src/contexts/AuthContext.js

import React, { createContext, useState, useEffect, useContext } from 'react';

// Get the authentication client from the window object
const ResumeAIAuth = window.ResumeAIAuth;

// Configure the client
ResumeAIAuth.configure({
  apiUrl: process.env.REACT_APP_API_URL || 'https://resumeai-simple-backend.onrender.com/api/v1'
});

// Create the context
const AuthContext = createContext();

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        if (ResumeAIAuth.isAuthenticated()) {
          const currentUser = await ResumeAIAuth.getCurrentUser();
          setUser(currentUser);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError('Failed to restore authentication');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Login function
  const login = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ResumeAIAuth.login(email, password);
      
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        setError(result.error || 'Login failed');
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await ResumeAIAuth.register(userData);
      
      if (result.success) {
        setUser(result.user);
        return { success: true };
      } else {
        setError(result.error || 'Registration failed');
        return { success: false, error: result.error };
      }
    } catch (err) {
      setError(err.message || 'Registration failed');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setLoading(true);
    
    try {
      await ResumeAIAuth.logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
      setError('Logout failed');
    } finally {
      setLoading(false);
    }
  };

  // Logout from all devices
  const logoutAll = async () => {
    setLoading(true);
    
    try {
      await ResumeAIAuth.logoutAll();
      setUser(null);
    } catch (err) {
      console.error('Logout all error:', err);
      setError('Logout from all devices failed');
    } finally {
      setLoading(false);
    }
  };

  // API request wrapper
  const apiRequest = async (endpoint, method = 'GET', body = null) => {
    try {
      return await ResumeAIAuth.apiRequest(endpoint, method, body);
    } catch (err) {
      if (err.message === 'Not authorized' || err.message.includes('token')) {
        setUser(null); // Clear user if auth error
      }
      throw err;
    }
  };

  // Value to be provided by the context
  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    logoutAll,
    apiRequest
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
```

### Step 3: Wrap Your Application with the AuthProvider

In your main app file, wrap your components with the `AuthProvider`:

```jsx
// src/App.js

import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Routes from './Routes';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes />
      </Router>
    </AuthProvider>
  );
}

export default App;
```

### Step 4: Create Protected Routes

Create a higher-order component for protecting routes:

```jsx
// src/components/ProtectedRoute.js

import React from 'react';
import { Route, Redirect } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ component: Component, ...rest }) => {
  const { isAuthenticated, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Route
      {...rest}
      render={props =>
        isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect to={{ pathname: '/login', state: { from: props.location } }} />
        )
      }
    />
  );
};

export default ProtectedRoute;
```

### Step 5: Use Authentication in Components

Now you can use the authentication context in your components:

```jsx
// src/components/Login.js

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useHistory, useLocation } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const history = useHistory();
  const location = useLocation();

  // Get redirect path if user was redirected to login
  const { from } = location.state || { from: { pathname: '/dashboard' } };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      return setError('Please provide both email and password');
    }

    const result = await login(email, password);

    if (result.success) {
      // Redirect to the page user came from or dashboard
      history.replace(from);
    } else {
      setError(result.error || 'Login failed');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default Login;
```

### Step 6: Make Authenticated API Requests

Use the `apiRequest` function from the auth context to make authenticated requests:

```jsx
// src/components/Dashboard.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, apiRequest, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiRequest('/some-endpoint');
        setData(result.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [apiRequest]);

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Welcome, {user.name}!</p>
      
      <button onClick={logout}>Logout</button>
      
      {loading && <p>Loading data...</p>}
      {error && <p className="error">Error: {error}</p>}
      {data && (
        <div>
          <h3>Your Data</h3>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
```

## Option 2: Building Your Own Integration

If you prefer to build your own integration, here's how to interact with the authentication API directly:

### Step 1: Registration

```javascript
const register = async (userData) => {
  try {
    const response = await fetch('https://resumeai-simple-backend.onrender.com/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    // Store tokens if needed (accessToken comes in HTTP-only cookie too)
    localStorage.setItem('accessToken', data.accessToken);
    
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};
```

### Step 2: Login

```javascript
const login = async (email, password) => {
  try {
    const response = await fetch('https://resumeai-simple-backend.onrender.com/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }
    
    // Store tokens if needed (accessToken comes in HTTP-only cookie too)
    localStorage.setItem('accessToken', data.accessToken);
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

### Step 3: Token Refresh

```javascript
const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    
    const response = await fetch('https://resumeai-simple-backend.onrender.com/api/v1/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
      credentials: 'include', // Important for cookies
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Token refresh failed');
    }
    
    // Update stored tokens
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    
    return data;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
};
```

### Step 4: Making Authenticated Requests

```javascript
const makeAuthenticatedRequest = async (url, method = 'GET', body = null) => {
  try {
    const accessToken = localStorage.getItem('accessToken');
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      credentials: 'include',
    };
    
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    let response = await fetch(url, options);
    
    // If unauthorized, try to refresh token and retry
    if (response.status === 401) {
      try {
        await refreshToken();
        
        // Update access token after refresh
        const newAccessToken = localStorage.getItem('accessToken');
        options.headers.Authorization = `Bearer ${newAccessToken}`;
        
        // Retry the request
        response = await fetch(url, options);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        window.location.href = '/login';
        throw new Error('Authentication expired. Please login again.');
      }
    }
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};
```

## Common Integration Issues

### CORS Issues

If you encounter CORS errors:

1. Ensure your frontend domain is allowed in the backend CORS configuration
2. Make sure to include `credentials: 'include'` in your fetch calls
3. Check that your cookies are being properly set and sent

### Token Storage Security

For better security:

1. Rely on HTTP-only cookies for token storage when possible
2. If using localStorage, be aware of XSS risks
3. Consider implementing token encryption for localStorage
4. Never store sensitive user information in localStorage or sessionStorage

### Error Handling

Implement robust error handling:

1. Detect authentication errors (401, 403)
2. Automatically redirect to login when authentication fails
3. Provide clear error messages to users
4. Log errors for debugging

## Need Help?

If you encounter any issues with the integration, please:

1. Check the [Authentication Demo](https://resumeai-simple-backend.onrender.com/auth-demo.html) to see the system in action
2. Review the [API Documentation](https://resumeai-simple-backend.onrender.com/README.md)
3. Contact the backend team for assistance

## Example Projects

For complete working examples, check out:

1. [React Authentication Example](https://github.com/example/react-auth) - React implementation
2. [Integration Test Repository](https://github.com/example/integration-tests) - Test suite 
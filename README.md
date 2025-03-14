# ResumeAI Backend

A secure and robust backend for the ResumeAI application with modern authentication functionality.

## Features

- **Secure Authentication System**
  - JWT-based authentication with access and refresh tokens
  - Token rotation for enhanced security
  - Cross-site request support with proper CORS configuration
  - Protection against token reuse and replay attacks
  - Session management including "logout from all devices" functionality

- **User Management**
  - User registration with validation
  - Secure password storage with bcrypt
  - User profile retrieval and updates

- **API Security**
  - Route protection middleware
  - Role-based access control
  - CORS configured for cross-domain requests
  - Input validation and sanitization

## Authentication System Documentation

### Overview

The authentication system uses a dual-token approach:

1. **Access Token** (JWT)
   - Short-lived (15 minutes by default)
   - Contains user identity and permissions
   - Used for API access authorization

2. **Refresh Token**
   - Long-lived (7 days by default)
   - Stored in the database with metadata
   - Used to obtain new access tokens
   - Implements token rotation for security
   - Protected against reuse with family-based revocation

### Token Rotation

For enhanced security, we implement refresh token rotation:

1. When a refresh token is used, it is immediately invalidated
2. A new refresh token is generated in the same "family"
3. If a previously used refresh token is detected, the entire token family is revoked, requiring a new login

### Authentication Flow

1. **Registration/Login**
   - User provides credentials
   - System generates access token and refresh token
   - Both tokens are sent to client (access token as HTTP-only cookie and response body)

2. **API Requests**
   - Client includes access token in Authorization header or uses the cookie
   - Server validates the token and authorizes the request

3. **Token Refresh**
   - When access token expires, client uses refresh token to get a new access token
   - The old refresh token is invalidated and a new one is issued
   - Both new tokens are sent to the client

4. **Logout**
   - Refresh token is revoked in the database
   - Client clears local tokens

## API Documentation

### Authentication Endpoints

#### POST /api/v1/auth/register
Register a new user

**Request Body:**
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "accessToken": "JWT_ACCESS_TOKEN",
  "refreshToken": "REFRESH_TOKEN",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### POST /api/v1/auth/login
Login with existing credentials

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
Same as register response

#### POST /api/v1/auth/refresh-token
Get a new access token using refresh token

**Request Body:**
```json
{
  "refreshToken": "REFRESH_TOKEN"
}
```
*Note: The refresh token can also be sent via HTTP-only cookie*

**Response:**
```json
{
  "success": true,
  "accessToken": "NEW_JWT_ACCESS_TOKEN",
  "refreshToken": "NEW_REFRESH_TOKEN",
  "user": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user"
  }
}
```

#### GET /api/v1/auth/logout
Logout current session

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /api/v1/auth/logout-all
Logout from all devices/sessions

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out from all devices"
}
```

#### GET /api/v1/auth/me
Get current user profile

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "user",
    "createdAt": "timestamp"
  }
}
```

## Client Authentication Tools

### Authentication Client

We provide a client-side authentication utility (`auth-client-v2.js`) that simplifies interaction with the authentication API. It handles:

- Token storage
- Automatic token refresh
- Request authorization
- Login, logout, and registration

#### Basic Usage

```javascript
// Configure the client
ResumeAIAuth.configure({
  apiUrl: 'https://your-api-url.com/api/v1'
});

// Register a new user
const registerResult = await ResumeAIAuth.register({
  name: 'User Name',
  email: 'user@example.com',
  password: 'securepassword'
});

// Login
const loginResult = await ResumeAIAuth.login('user@example.com', 'securepassword');

// Check if user is authenticated
if (ResumeAIAuth.isAuthenticated()) {
  // User is logged in
}

// Get current user
const user = await ResumeAIAuth.getCurrentUser();

// Make an authenticated API request
const data = await ResumeAIAuth.apiRequest('/some-endpoint', 'GET');

// Refresh token manually (normally happens automatically)
await ResumeAIAuth.refreshToken();

// Logout
await ResumeAIAuth.logout();

// Logout from all devices
await ResumeAIAuth.logoutAll();
```

## Demo and Testing

The backend includes test tools for validating authentication functionality:

1. **Authentication Test Script** - `scripts/test-auth.js`
   - Automated test script that validates all authentication endpoints
   - Tests user registration, login, token refresh, and security features
   - Run with: `node scripts/test-auth.js`

2. **Interactive Demo** - `public/auth-demo.html`
   - Browser-based interface for testing authentication flows
   - Provides a visual interface for registration, login, and other auth functions
   - Access at: `http://localhost:8000/auth-demo.html`

## Development

### Prerequisites

- Node.js 14+
- MongoDB

### Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```

3. Configure environment variables in `config/config.env`:
   ```
   NODE_ENV=development
   PORT=8000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_at_least_32_chars_long
   JWT_ACCESS_EXPIRE=15m
   JWT_REFRESH_EXPIRE_DAYS=7
   CLIENT_URL=http://localhost:3000
   ```

4. Start the server:
   ```
   npm run dev
   ```

## Security Considerations

- Access tokens are short-lived to minimize the impact of token theft
- Refresh tokens are rotated with each use, allowing for token revocation
- Token reuse detection helps prevent replay attacks
- Tokens can be revoked individually or for all user sessions
- Credentials are never stored in plaintext
- Sensitive operations require re-authentication

## Integration with Frontend

To integrate with a React frontend:

1. Include the auth client in your application
2. Configure the client with your API URL
3. Use the provided methods for authentication flows
4. Protect routes based on authentication status
5. Add automatic token refresh before API calls

## Deployment

This backend is deployed on Render.com at https://resumeai-simple-backend.onrender.com

## License

MIT 
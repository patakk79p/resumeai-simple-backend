// Script to test user registration
const axios = require('axios');

// Change these values as needed
const API_URL = 'https://resumeai-simple-backend.onrender.com';
const userData = {
  name: 'Test User',
  email: `test${Date.now()}@example.com`,
  password: 'password123'
};

console.log('Testing registration with data:', userData);

axios.post(`${API_URL}/api/v1/auth/register`, userData, {
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(response => {
  console.log('Registration successful!');
  console.log('Response status:', response.status);
  console.log('Response data:', JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('Registration failed!');
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error('Status:', error.response.status);
    console.error('Data:', JSON.stringify(error.response.data, null, 2));
    console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
  } else if (error.request) {
    // The request was made but no response was received
    console.error('No response received');
    console.error(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error('Error:', error.message);
  }
}); 
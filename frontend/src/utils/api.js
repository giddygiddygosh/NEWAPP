// src/utils/api.js

import axios from 'axios';

// Determine the API_BASE_URL based on the environment
let API_BASE_URL;

// process.env.NODE_ENV is a special variable injected by React build tools (like Create React App)
// It will be 'development' when you run 'npm start'
// It will be 'production' when you run 'npm run build'
if (process.env.NODE_ENV === 'production') {
    // IMPORTANT: You MUST replace 'https://YOUR_PRODUCTION_BACKEND_URL.com/api'
    // with the actual public URL of your deployed Node.js backend API.
    // Example: If your backend is deployed on Render, it might be something like:
    // 'https://my-scheduler-backend-12345.onrender.com/api'
    // If it's on AWS EC2, it would be your EC2 instance's public IP or domain.
    API_BASE_URL = 'https://YOUR_PRODUCTION_BACKEND_URL.com/api'; // <--- YOU MUST CHANGE THIS LINE
} else {
    // In development, use your local backend URL
    API_BASE_URL = 'http://localhost:5000/api'; // Adjust port if your local backend runs on a different one
}

// --- CRITICAL DEBUGGING LINE ---
// This will print the API_BASE_URL to your browser's console.
// After deployment, check this in your live app's console (F12 -> Console tab).
// It MUST show your production backend URL.
console.log("Frontend API Base URL configured:", API_BASE_URL);

// --- Instance for Your Authenticated Backend API ---
// This one WILL have the interceptor.
const api = axios.create({
    baseURL: API_BASE_URL, // Use the dynamically determined base URL
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add the interceptor ONLY to the instance for your backend
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// --- Instance for Public, External APIs (like Google) ---
// This one will NOT have an interceptor.
export const publicApi = axios.create({
    // No baseURL is needed as it will be used for various domains
    headers: {
        'Content-Type': 'application/json',
    },
});

// Export the default instance for your backend
export default api;
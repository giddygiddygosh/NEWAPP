// src/utils/api.js

import axios from 'axios';

// Determine the API_BASE_URL based on the environment
let API_BASE_URL;

if (process.env.NODE_ENV === 'production') {
    // IMPORTANT: You MUST replace 'https://YOUR_PRODUCTION_BACKEND_URL.com/api'
    // with the actual public URL of your deployed Node.js backend API.
    API_BASE_URL = 'https://YOUR_PRODUCTION_BACKEND_URL.com/api';
} else {
    // In development, use your local backend URL with the new port
    API_BASE_URL = 'http://localhost:5004/api'; // Changed to 5004
}

// --- CRITICAL DEBUGGING LINE ---
console.log("Frontend API Base URL configured:", API_BASE_URL);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

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

export const publicApi = axios.create({
    headers: {
        'Content-Type': 'application/json',
    },
});

export default api;

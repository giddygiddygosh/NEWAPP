// src/firebase.js
// This file initializes your Firebase app and exports the authentication instance.

// Import the functions you need from the Firebase SDKs
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Specifically for Firebase Authentication
// import { getAnalytics } from "firebase/analytics"; // Uncomment if you uncomment measurementId

// Your web app's Firebase configuration from .env variables
const firebaseConfig = {
  apiKey: "AIzaSyA7GzgMWiNsyBY-cQOQ8aCo2oizn4768Ck",
  authDomain: "finalproject-35af4.firebaseapp.com",
  projectId: "finalproject-35af4",
  storageBucket: "finalproject-35af4.firebasestorage.app",
  messagingSenderId: "142018845673",
  appId: "1:142018845673:web:0dc7fba8450686741dc978",
  measurementId: "G-QLS4M3HSN4"
};


// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// If you uncommented measurementId, uncomment this line too:
// export const analytics = getAnalytics(app);

// Add Firebase Admin SDK to your backend ONLY, not here.
// For Google Maps API Key:
// If you have a Google Maps API key, manage it separately:
// - For client-side maps, embed it securely via script tag with domain restrictions.
// - For server-side API calls, keep it strictly in your backend's .env and use it server-side only.
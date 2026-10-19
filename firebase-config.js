import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

// Micro Job Firebase Configuration

const firebaseConfig = {
  apiKey: "AIzaSyCgv2bgg2hNhzuqN0_lQFe_SroN_iZeZQY",
  authDomain: "micro-job-6325c.firebaseapp.com",
  projectId: "micro-job-6325c",
  storageBucket: "micro-job-6325c.firebasestorage.app",
  messagingSenderId: "857353085475",
  appId: "1:857353085475:web:1cfee9e46c41dc0bd70796",
  measurementId: "G-CJFLPEV19S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Export Firebase Services
export { app, auth, db };

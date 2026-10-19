import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCgv2bgg2hNhzuqN0_lQFe_SroN_iZeZQY",
  authDomain: "micro-job-6325c.firebaseapp.com",
  projectId: "micro-job-6325c",
  storageBucket: "micro-job-6325c.firebasestorage.app",
  messagingSenderId: "857353085475",
  appId: "1:857353085475:web:1cfee9e46c41dc0bd70796",
  measurementId: "G-CJFLPEV19S"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

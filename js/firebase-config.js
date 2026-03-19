/**
 * firebase-config.js - Firebase initialization and configuration
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQIYuwFk5u04qsrDm-pDzSLk0lH6RPAGs",
  authDomain: "mugla-tarim-harita.firebaseapp.com",
  databaseURL: "https://mugla-tarim-harita-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "mugla-tarim-harita",
  storageBucket: "mugla-tarim-harita.firebasestorage.app",
  messagingSenderId: "769677322857",
  appId: "1:769677322857:web:4a21dd74f836c23a8f90f8",
  measurementId: "G-XZV76YJQGJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);


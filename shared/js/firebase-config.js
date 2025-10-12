// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD060mtM75w-BvSHKsFeTzG74pqWpnT970",
    authDomain: "timetoparty-16cab.firebaseapp.com",
    projectId: "timetoparty-16cab",
    storageBucket: "timetoparty-16cab.firebasestorage.app",
    messagingSenderId: "814925530473",
    appId: "1:814925530473:web:a1b329b985f0811283a9f8",
    measurementId: "G-2SNQ4WDD57"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
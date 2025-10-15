// Firebase Configuration and Initialization
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, enableNetwork, disableNetwork, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
console.log('Initializing Firebase...');
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Add connection monitoring
console.log('Firebase initialized successfully');
console.log('Auth domain:', firebaseConfig.authDomain);
console.log('Project ID:', firebaseConfig.projectId);

// Test Firebase connection
window.testFirebaseConnection = async function() {
    try {
        console.log('Testing Firebase connection...');
        await enableNetwork(db);
        console.log('✅ Firebase network enabled successfully');
        
        // Try a simple test operation
        const testDoc = doc(db, 'test', 'connection');
        const testResult = await getDoc(testDoc);
        console.log('✅ Firebase connection test completed');
        
        return true;
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        return false;
    }
};
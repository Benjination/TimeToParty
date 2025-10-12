// Dashboard Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from '../../shared/js/firebase-config.js';

// DOM Elements
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// Authentication Functions
async function handleLogout() {
    try {
        await signOut(auth);
        console.log('User logged out');
        // Redirect to login page
        window.location.href = '../login/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to log out. Please try again.');
    }
}

function updateUserInfo(user) {
    if (user && userEmailSpan) {
        userEmailSpan.textContent = user.email;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auth state listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('User is signed in:', user);
            updateUserInfo(user);
        } else {
            console.log('User is signed out');
            // Redirect to login if not authenticated
            window.location.href = '../login/login.html';
        }
    });
    
    // Logout button
    logoutBtn?.addEventListener('click', handleLogout);
});
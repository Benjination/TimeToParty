// Signup Page JavaScript
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, query, where, getDocs, collection } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';

// DOM Elements
const signupForm = document.getElementById('signup-form');

// Authentication Functions
async function handleSignup(username, email, password, confirmPassword) {
    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
        showError('Username must be between 3 and 20 characters.', signupForm);
        return;
    }
    
    // Validate username format (letters, numbers, underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showError('Username can only contain letters, numbers, and underscores.', signupForm);
        return;
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showError('Passwords do not match. Please try again.', signupForm);
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        showError('Password must be at least 6 characters long.', signupForm);
        return;
    }
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create user profile in Firestore with username
        await setDoc(doc(db, 'users', user.uid), {
            username: username,
            email: email,
            createdAt: new Date(),
            friends: [],
            groups: []
        });
        
        console.log('User created:', user);
        showSuccess('Account created successfully! Welcome to the party!', signupForm);
        
        // Redirect to dashboard after a brief delay
        setTimeout(() => {
            // Check if there's a pending group to join
            const pendingGroupId = sessionStorage.getItem('pendingGroupId');
            if (pendingGroupId) {
                window.location.href = `../join-group/join-group.html?groupId=${pendingGroupId}`;
            } else {
                window.location.href = '../dashboard/dashboard.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Failed to create account. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'An account already exists with this email. Please log in instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please choose a stronger password.';
                break;
        }
        
        showError(errorMessage, signupForm);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is already logged in
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Redirect to dashboard if already logged in
            window.location.href = '../dashboard/dashboard.html';
        }
    });
    
    // Form event listener
    signupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        addLoadingState(submitBtn);
        
        await handleSignup(username, email, password, confirmPassword);
        
        removeLoadingState(submitBtn, originalText);
    });
});
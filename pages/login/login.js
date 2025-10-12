// Login Page JavaScript
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';

// DOM Elements
const loginForm = document.getElementById('login-form');
const forgotPasswordForm = document.getElementById('forgot-password-form');
const forgotPasswordModal = document.getElementById('forgot-password-modal');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const closeModal = document.querySelector('.close');

// Authentication Functions
async function handleLogin(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('User logged in:', userCredential.user);
        
        // Check if there's a pending group to join
        const pendingGroupId = sessionStorage.getItem('pendingGroupId');
        if (pendingGroupId) {
            window.location.href = `../join-group/join-group.html?groupId=${pendingGroupId}`;
        } else {
            // Redirect to dashboard
            window.location.href = '../dashboard/dashboard.html';
        }
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Failed to log in. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email. Please sign up first.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
        }
        
        showError(errorMessage, loginForm);
    }
}

async function handleForgotPassword(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        showSuccess('Password reset email sent! Check your inbox.', forgotPasswordForm);
        
        // Close modal after success
        setTimeout(() => {
            forgotPasswordModal.style.display = 'none';
        }, 2000);
        
    } catch (error) {
        console.error('Password reset error:', error);
        let errorMessage = 'Failed to send reset email. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
        }
        
        showError(errorMessage, forgotPasswordForm);
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
    
    // Modal event listeners
    forgotPasswordLink?.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'block';
    });
    
    closeModal?.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.style.display = 'none';
        }
    });
    
    // Form event listeners
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        addLoadingState(submitBtn);
        
        await handleLogin(email, password);
        
        removeLoadingState(submitBtn, originalText);
    });
    
    forgotPasswordForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('forgot-email').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        addLoadingState(submitBtn);
        
        await handleForgotPassword(email);
        
        removeLoadingState(submitBtn, originalText);
    });
});
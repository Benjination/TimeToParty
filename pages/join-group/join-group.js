// Join Group Page JavaScript
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { getGroup, joinGroup } from '../../shared/js/database.js';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const groupInfoState = document.getElementById('group-info-state');
const errorState = document.getElementById('error-state');
const successState = document.getElementById('success-state');
const notLoggedInState = document.getElementById('not-logged-in-state');
const joinPartyBtn = document.getElementById('join-party-btn');
const groupInfoDisplay = document.getElementById('group-info-display');
const errorMessage = document.getElementById('error-message');

let currentUser = null;
let groupId = null;
let groupData = null;

// Get group ID from URL parameters
function getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('groupId');
}

// State management functions
function showState(stateElement) {
    // Hide all states
    [loadingState, groupInfoState, errorState, successState, notLoggedInState].forEach(state => {
        state.style.display = 'none';
    });
    
    // Show the specified state
    stateElement.style.display = 'block';
}

// Load and display group information
async function loadGroupInfo(groupId) {
    try {
        const result = await getGroup(groupId);
        
        if (result.success) {
            groupData = result.data;
            displayGroupInfo(groupData);
            showState(groupInfoState);
        } else {
            showError('Party not found or no longer active.');
        }
    } catch (error) {
        console.error('Error loading group:', error);
        showError('Failed to load party information.');
    }
}

function displayGroupInfo(group) {
    groupInfoDisplay.innerHTML = `
        <div class="group-info-card">
            <h3>${group.name}</h3>
            <p><strong>Description:</strong> ${group.description || 'No description provided'}</p>
            <div class="group-stats">
                <div class="stat-item">
                    <span class="stat-value">${group.groupId}</span>
                    <div class="stat-label">Party ID</div>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${group.members.length}/${group.maxPlayers}</span>
                    <div class="stat-label">Players</div>
                </div>
                <div class="stat-item">
                    <span class="stat-value">${group.members.length < group.maxPlayers ? 'Open' : 'Full'}</span>
                    <div class="stat-label">Status</div>
                </div>
            </div>
        </div>
    `;
    
    // Disable join button if party is full
    if (group.members.length >= group.maxPlayers) {
        joinPartyBtn.textContent = 'Party is Full';
        joinPartyBtn.disabled = true;
        joinPartyBtn.style.opacity = '0.5';
    }
}

function showError(message) {
    errorMessage.textContent = message;
    showState(errorState);
}

// Handle joining the group
async function handleJoinGroup() {
    if (!currentUser || !groupId) return;
    
    // Add loading state to button
    const originalText = joinPartyBtn.innerHTML;
    joinPartyBtn.innerHTML = '<span class="loading"></span> Joining...';
    joinPartyBtn.disabled = true;
    
    try {
        const result = await joinGroup(currentUser.uid, groupId);
        
        if (result.success) {
            showState(successState);
            
            // Store the group ID in session storage for redirection
            sessionStorage.setItem('joinedGroupId', groupId);
        } else {
            showError(result.error);
            // Reset button
            joinPartyBtn.innerHTML = originalText;
            joinPartyBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error joining group:', error);
        showError('Failed to join party. Please try again.');
        // Reset button
        joinPartyBtn.innerHTML = originalText;
        joinPartyBtn.disabled = false;
    }
}

// Initialize the page
function initializePage() {
    groupId = getGroupIdFromUrl();
    
    if (!groupId || !/^\d{6}$/.test(groupId)) {
        showError('Invalid party invitation link.');
        return;
    }
    
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            
            // Ensure user profile exists in Firestore
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    lastLogin: new Date()
                }, { merge: true });
            } catch (error) {
                console.error('Error updating user profile:', error);
            }
            
            // Load group information
            await loadGroupInfo(groupId);
        } else {
            // User not logged in - show signup prompt
            showState(notLoggedInState);
            
            // Store the group ID to join after login
            sessionStorage.setItem('pendingGroupId', groupId);
        }
    });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user just joined a group (redirect from login/signup)
    const pendingGroupId = sessionStorage.getItem('pendingGroupId');
    if (pendingGroupId) {
        sessionStorage.removeItem('pendingGroupId');
        // Update URL to reflect the group they're trying to join
        if (!getGroupIdFromUrl()) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('groupId', pendingGroupId);
            window.history.replaceState({}, '', newUrl);
        }
    }
    
    // Initialize the page
    initializePage();
    
    // Join button event listener
    joinPartyBtn?.addEventListener('click', handleJoinGroup);
});
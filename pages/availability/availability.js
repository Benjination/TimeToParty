// Availability Scheduler JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess } from '../../shared/js/utils.js';
import { getUserGroups } from '../../shared/js/database.js';

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const currentDateDisplay = document.getElementById('current-date-display');
const currentDayName = document.getElementById('current-day-name');
const timeGrid = document.getElementById('time-grid');
const timeLabels = document.querySelector('.time-labels');
const clearDayBtn = document.getElementById('clear-day');
const saveAvailabilityBtn = document.getElementById('save-availability');
const partySelect = document.getElementById('party-select');
const partyAvailabilityGrid = document.getElementById('party-availability-grid');

// State
let currentUser = null;
let currentDate = new Date();
let availability = {}; // Format: { "2025-10-12": { 0: "available", 1: "unavailable", ... } }
let userGroups = [];

// Initialize time slots (24 hours)
const timeSlots = Array.from({ length: 24 }, (_, i) => i);

// Availability states
const AVAILABILITY_STATES = {
    NEUTRAL: 'neutral',
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable'
};

// Initialize the page
function initializePage() {
    createTimeLabels();
    createTimeGrid();
    updateDateDisplay();
    loadUserAvailability();
}

// Create time labels (12 AM, 1 AM, etc.)
function createTimeLabels() {
    timeLabels.innerHTML = timeSlots.map(hour => {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        return `<div class="time-label">${displayHour}${ampm}</div>`;
    }).join('');
}

// Create the interactive time grid
function createTimeGrid() {
    const dateKey = formatDateKey(currentDate);
    const dayAvailability = availability[dateKey] || {};
    
    timeGrid.innerHTML = '';
    
    // Add hour labels and time slots for each hour
    timeSlots.forEach(hour => {
        // Add hour label
        const hourLabel = document.createElement('div');
        hourLabel.className = 'hour-label';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour < 12 ? 'AM' : 'PM';
        hourLabel.textContent = `${displayHour}:00 ${ampm}`;
        timeGrid.appendChild(hourLabel);
        
        // Add time slot
        const timeSlot = document.createElement('div');
        timeSlot.className = `time-slot ${dayAvailability[hour] || AVAILABILITY_STATES.NEUTRAL}`;
        timeSlot.dataset.hour = hour;
        timeSlot.addEventListener('click', () => toggleTimeSlot(hour));
        timeGrid.appendChild(timeSlot);
    });
}

// Toggle time slot availability
function toggleTimeSlot(hour) {
    const dateKey = formatDateKey(currentDate);
    if (!availability[dateKey]) {
        availability[dateKey] = {};
    }
    
    const currentState = availability[dateKey][hour] || AVAILABILITY_STATES.NEUTRAL;
    let newState;
    
    // Cycle through states: neutral -> available -> unavailable -> neutral
    switch (currentState) {
        case AVAILABILITY_STATES.NEUTRAL:
            newState = AVAILABILITY_STATES.AVAILABLE;
            break;
        case AVAILABILITY_STATES.AVAILABLE:
            newState = AVAILABILITY_STATES.UNAVAILABLE;
            break;
        case AVAILABILITY_STATES.UNAVAILABLE:
            newState = AVAILABILITY_STATES.NEUTRAL;
            break;
        default:
            newState = AVAILABILITY_STATES.AVAILABLE;
    }
    
    availability[dateKey][hour] = newState;
    
    // Update the visual state
    const timeSlot = timeGrid.querySelector(`[data-hour="${hour}"]`);
    if (timeSlot) {
        timeSlot.className = `time-slot ${newState}`;
    }
}

// Date navigation functions
function goToPreviousDay() {
    currentDate.setDate(currentDate.getDate() - 1);
    updateDateDisplay();
    createTimeGrid();
}

function goToNextDay() {
    currentDate.setDate(currentDate.getDate() + 1);
    updateDateDisplay();
    createTimeGrid();
}

function updateDateDisplay() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    currentDateDisplay.textContent = currentDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
    });
    
    currentDayName.textContent = currentDate.toLocaleDateString('en-US', {
        weekday: 'long'
    });
}

// Clear all availability for current day
function clearCurrentDay() {
    const dateKey = formatDateKey(currentDate);
    if (availability[dateKey]) {
        delete availability[dateKey];
    }
    createTimeGrid();
}

// Save availability to Firebase
async function saveAvailability() {
    if (!currentUser) return;
    
    try {
        const userAvailabilityRef = doc(db, 'availability', currentUser.uid);
        await setDoc(userAvailabilityRef, {
            userId: currentUser.uid,
            availability: availability,
            lastUpdated: new Date()
        }, { merge: true });
        
        // Show success message
        const successDiv = document.createElement('div');
        successDiv.className = 'save-success';
        successDiv.textContent = 'Availability saved successfully!';
        saveAvailabilityBtn.parentNode.insertBefore(successDiv, saveAvailabilityBtn.nextSibling);
        
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.remove();
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error saving availability:', error);
        showError('Failed to save availability. Please try again.', document.querySelector('.availability-actions'));
    }
}

// Load user's availability from Firebase
async function loadUserAvailability() {
    if (!currentUser) return;
    
    try {
        const userAvailabilityRef = doc(db, 'availability', currentUser.uid);
        const availabilitySnap = await getDoc(userAvailabilityRef);
        
        if (availabilitySnap.exists()) {
            const data = availabilitySnap.data();
            availability = data.availability || {};
        } else {
            availability = {};
        }
        
        createTimeGrid();
    } catch (error) {
        console.error('Error loading availability:', error);
        availability = {};
        createTimeGrid();
    }
}

// Load user's groups for party availability view
async function loadUserGroups() {
    if (!currentUser) return;
    
    try {
        const result = await getUserGroups(currentUser.uid);
        
        if (result.success) {
            userGroups = result.data;
            populatePartySelect();
        } else {
            userGroups = [];
            partySelect.innerHTML = '<option value="">No parties found</option>';
        }
    } catch (error) {
        console.error('Error loading user groups:', error);
        userGroups = [];
    }
}

// Populate party selector dropdown
function populatePartySelect() {
    partySelect.innerHTML = '<option value="">Select a party...</option>';
    
    userGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.groupId;
        option.textContent = `${group.name} (${group.members.length} members)`;
        partySelect.appendChild(option);
    });
}

// Load and display party availability
async function loadPartyAvailability(groupId) {
    if (!groupId) {
        partyAvailabilityGrid.innerHTML = '<p class="no-party-selected">Select a party to see everyone\'s availability</p>';
        return;
    }
    
    partyAvailabilityGrid.innerHTML = '<div class="loading-availability">Loading party availability...</div>';
    
    try {
        // Find the selected group
        const selectedGroup = userGroups.find(group => group.groupId === groupId);
        if (!selectedGroup) return;
        
        // Load availability for all members
        const memberAvailabilities = {};
        
        for (const memberId of selectedGroup.members) {
            try {
                const memberAvailabilityRef = doc(db, 'availability', memberId);
                const availabilitySnap = await getDoc(memberAvailabilityRef);
                
                if (availabilitySnap.exists()) {
                    memberAvailabilities[memberId] = availabilitySnap.data().availability || {};
                } else {
                    memberAvailabilities[memberId] = {};
                }
            } catch (error) {
                console.error(`Error loading availability for ${memberId}:`, error);
                memberAvailabilities[memberId] = {};
            }
        }
        
        displayPartyAvailability(selectedGroup, memberAvailabilities);
        
    } catch (error) {
        console.error('Error loading party availability:', error);
        partyAvailabilityGrid.innerHTML = '<p class="loading-availability">Failed to load party availability</p>';
    }
}

// Display party availability grid
function displayPartyAvailability(group, memberAvailabilities) {
    const dateKey = formatDateKey(currentDate);
    
    let html = `
        <div class="party-grid-header">
            <div class="party-member-row">
                <div class="member-name">Member</div>
                ${timeSlots.map(hour => {
                    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                    const ampm = hour < 12 ? 'AM' : 'PM';
                    return `<div class="member-time-slot" style="background: none; border: none; color: #d4af37; font-size: 0.7rem; text-align: center;">${displayHour}</div>`;
                }).join('')}
            </div>
        </div>
    `;
    
    group.members.forEach(memberId => {
        const memberAvailability = memberAvailabilities[memberId][dateKey] || {};
        const displayName = memberId === currentUser.uid ? 'You' : `User ${memberId.substring(0, 6)}`;
        
        html += `
            <div class="party-member-row">
                <div class="member-name">${displayName}</div>
                ${timeSlots.map(hour => {
                    const state = memberAvailability[hour] || AVAILABILITY_STATES.NEUTRAL;
                    return `<div class="member-time-slot ${state}"></div>`;
                }).join('')}
            </div>
        `;
    });
    
    partyAvailabilityGrid.innerHTML = html;
}

// Utility functions
function formatDateKey(date) {
    return date.toISOString().split('T')[0]; // Format: "2025-10-12"
}

// Authentication
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = '../login/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to log out. Please try again.');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('User is signed in:', user);
            
            // Ensure user profile exists
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    lastLogin: new Date()
                }, { merge: true });
            } catch (error) {
                console.error('Error updating user profile:', error);
            }
            
            initializePage();
            loadUserGroups();
        } else {
            window.location.href = '../login/login.html';
        }
    });
    
    // Navigation event listeners
    prevDayBtn?.addEventListener('click', goToPreviousDay);
    nextDayBtn?.addEventListener('click', goToNextDay);
    clearDayBtn?.addEventListener('click', clearCurrentDay);
    saveAvailabilityBtn?.addEventListener('click', saveAvailability);
    logoutBtn?.addEventListener('click', handleLogout);
    
    // Party selection
    partySelect?.addEventListener('change', (e) => {
        loadPartyAvailability(e.target.value);
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToPreviousDay();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToNextDay();
        }
    });
});
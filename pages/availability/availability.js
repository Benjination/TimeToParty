// Availability Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';
import { getUserGroups, getUsersByIds } from '../../shared/js/database.js';

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const prevWeekBtn = document.getElementById('prev-week');
const nextWeekBtn = document.getElementById('next-week');
const currentWeekDisplay = document.getElementById('current-week-display');
const scheduleGridContent = document.getElementById('schedule-grid-content');
const clearWeekBtn = document.getElementById('clear-week');
const saveAvailabilityBtn = document.getElementById('save-availability');
const partyAvailabilityList = document.getElementById('party-availability-list');

let currentUser = null;
let currentWeekStart = null;
let weeklyAvailability = {};

// Time slots (48 half-hour slots per day)
const timeSlots = [];
for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
        const time = new Date();
        time.setHours(hour, minute, 0, 0);
        timeSlots.push({
            hour,
            minute,
            display: time.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
            })
        });
    }
}

// Days of the week
const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Initialize week to current week
function initializeWeek() {
    const today = new Date();
    // Get the start of the current week (Sunday)
    const dayOfWeek = today.getDay();
    currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - dayOfWeek);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    updateWeekDisplay();
    generateScheduleGrid();
    loadWeeklyAvailability();
}

// Update week display
function updateWeekDisplay() {
    const endOfWeek = new Date(currentWeekStart);
    endOfWeek.setDate(currentWeekStart.getDate() + 6);
    
    const startStr = currentWeekStart.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
    });
    const endStr = endOfWeek.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    
    currentWeekDisplay.textContent = `${startStr} - ${endStr}`;
}

// Generate the weekly schedule grid
function generateScheduleGrid() {
    let gridHTML = '';
    
    // Generate time slots and corresponding day slots
    timeSlots.forEach((timeSlot, timeIndex) => {
        // Time label
        gridHTML += `<div class="time-label">${timeSlot.display}</div>`;
        
        // Day slots for this time
        for (let day = 0; day < 7; day++) {
            const slotId = `${day}-${timeIndex}`;
            gridHTML += `
                <div class="time-slot" 
                     data-day="${day}" 
                     data-time="${timeIndex}" 
                     onclick="toggleTimeSlot(${day}, ${timeIndex})"
                     oncontextmenu="setUnavailable(event, ${day}, ${timeIndex})"
                     ondblclick="setPreferred(${day}, ${timeIndex})">
                </div>
            `;
        }
    });
    
    scheduleGridContent.innerHTML = gridHTML;
}

// Toggle time slot availability
function toggleTimeSlot(day, timeIndex) {
    const slotKey = `${day}-${timeIndex}`;
    const currentState = weeklyAvailability[slotKey] || 'none';
    
    // Cycle through states: none -> available -> none
    if (currentState === 'none') {
        weeklyAvailability[slotKey] = 'available';
    } else if (currentState === 'available') {
        weeklyAvailability[slotKey] = 'none';
    } else if (currentState === 'preferred') {
        weeklyAvailability[slotKey] = 'available';
    } else if (currentState === 'unavailable') {
        weeklyAvailability[slotKey] = 'available';
    }
    
    updateSlotVisual(day, timeIndex);
}

// Set preferred time (double-click)
function setPreferred(day, timeIndex) {
    const slotKey = `${day}-${timeIndex}`;
    weeklyAvailability[slotKey] = 'preferred';
    updateSlotVisual(day, timeIndex);
}

// Set unavailable (right-click)
function setUnavailable(event, day, timeIndex) {
    event.preventDefault();
    const slotKey = `${day}-${timeIndex}`;
    weeklyAvailability[slotKey] = 'unavailable';
    updateSlotVisual(day, timeIndex);
}

// Update slot visual appearance
function updateSlotVisual(day, timeIndex) {
    const slot = document.querySelector(`[data-day="${day}"][data-time="${timeIndex}"]`);
    const slotKey = `${day}-${timeIndex}`;
    const state = weeklyAvailability[slotKey] || 'none';
    
    // Remove all state classes
    slot.classList.remove('available', 'preferred', 'unavailable');
    
    // Add appropriate class
    if (state !== 'none') {
        slot.classList.add(state);
    }
}

// Clear entire week
function clearWeek() {
    if (confirm('Are you sure you want to clear all availability for this week?')) {
        weeklyAvailability = {};
        
        // Update all slots
        for (let day = 0; day < 7; day++) {
            for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
                updateSlotVisual(day, timeIndex);
            }
        }
    }
}

// Save availability to Firestore
async function saveAvailability() {
    if (!currentUser) return;
    
    try {
        addLoadingState(saveAvailabilityBtn);
        
        // Create availability document for this week
        const weekId = currentWeekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
        const availabilityRef = doc(db, 'availability', `${currentUser.uid}_${weekId}`);
        
        await setDoc(availabilityRef, {
            userId: currentUser.uid,
            weekStart: currentWeekStart,
            availability: weeklyAvailability,
            lastUpdated: new Date()
        });
        
        showSuccess('Availability saved successfully!');
        loadPartyAvailability();
        
    } catch (error) {
        console.error('Error saving availability:', error);
        showError('Failed to save availability. Please try again.');
    } finally {
        removeLoadingState(saveAvailabilityBtn, 'Save Availability');
    }
}

// Load weekly availability from Firestore
async function loadWeeklyAvailability() {
    if (!currentUser) return;
    
    try {
        const weekId = currentWeekStart.toISOString().split('T')[0];
        const availabilityRef = doc(db, 'availability', `${currentUser.uid}_${weekId}`);
        const availabilitySnap = await getDoc(availabilityRef);
        
        if (availabilitySnap.exists()) {
            weeklyAvailability = availabilitySnap.data().availability || {};
        } else {
            weeklyAvailability = {};
        }
        
        // Update all slot visuals
        for (let day = 0; day < 7; day++) {
            for (let timeIndex = 0; timeIndex < timeSlots.length; timeIndex++) {
                updateSlotVisual(day, timeIndex);
            }
        }
        
    } catch (error) {
        console.error('Error loading availability:', error);
        weeklyAvailability = {};
    }
}

// Load party availability overview
async function loadPartyAvailability() {
    if (!currentUser) return;
    
    try {
        const groupsResult = await getUserGroups(currentUser.uid);
        
        if (groupsResult.success && groupsResult.data.length > 0) {
            const partyData = [];
            
            for (const group of groupsResult.data) {
                // Get all member availability for this week
                const weekId = currentWeekStart.toISOString().split('T')[0];
                const memberAvailability = {};
                
                for (const memberId of group.members) {
                    try {
                        const memberAvailRef = doc(db, 'availability', `${memberId}_${weekId}`);
                        const memberAvailSnap = await getDoc(memberAvailRef);
                        if (memberAvailSnap.exists()) {
                            memberAvailability[memberId] = memberAvailSnap.data().availability || {};
                        }
                    } catch (error) {
                        console.error(`Error loading availability for member ${memberId}:`, error);
                    }
                }
                
                partyData.push({
                    group,
                    memberAvailability
                });
            }
            
            displayPartyAvailability(partyData);
        } else {
            partyAvailabilityList.innerHTML = '<div class="no-parties-message">You are not in any parties yet.</div>';
        }
    } catch (error) {
        console.error('Error loading party availability:', error);
        partyAvailabilityList.innerHTML = '<div class="no-parties-message">Failed to load party availability.</div>';
    }
}

// Display party availability summary
function displayPartyAvailability(partyData) {
    if (partyData.length === 0) {
        partyAvailabilityList.innerHTML = '<div class="no-parties-message">No parties found.</div>';
        return;
    }
    
    const partiesHTML = partyData.map(({ group, memberAvailability }) => {
        const daysSummary = daysOfWeek.map((dayName, dayIndex) => {
            const availableSlots = [];
            
            // Check each time slot for this day
            timeSlots.forEach((timeSlot, timeIndex) => {
                let availableMembers = 0;
                let totalMembers = 0;
                
                Object.values(memberAvailability).forEach(availability => {
                    totalMembers++;
                    const slotKey = `${dayIndex}-${timeIndex}`;
                    const state = availability[slotKey];
                    if (state === 'available' || state === 'preferred') {
                        availableMembers++;
                    }
                });
                
                if (availableMembers >= Math.ceil(totalMembers * 0.5)) { // 50% or more available
                    availableSlots.push(timeSlot.display);
                }
            });
            
            return `
                <div class="day-summary">
                    <h5>${dayName.slice(0, 3)}</h5>
                    <div class="available-times">
                        ${availableSlots.length > 0 ? 
                            availableSlots.slice(0, 3).join('<br>') + 
                            (availableSlots.length > 3 ? `<br>+${availableSlots.length - 3} more` : '') 
                            : 'No overlap'}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="party-card">
                <h4>${group.name} (${group.members.length} members)</h4>
                <div class="availability-summary">
                    ${daysSummary}
                </div>
            </div>
        `;
    }).join('');
    
    partyAvailabilityList.innerHTML = partiesHTML;
}

// Navigation functions
function goToPreviousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay();
    loadWeeklyAvailability();
    loadPartyAvailability();
}

function goToNextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay();
    loadWeeklyAvailability();
    loadPartyAvailability();
}

// Make functions global for onclick handlers
window.toggleTimeSlot = toggleTimeSlot;
window.setPreferred = setPreferred;
window.setUnavailable = setUnavailable;

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
            
            initializeWeek();
            loadPartyAvailability();
        } else {
            window.location.href = '../login/login.html';
        }
    });
    
    // Button event listeners
    logoutBtn?.addEventListener('click', handleLogout);
    prevWeekBtn?.addEventListener('click', goToPreviousWeek);
    nextWeekBtn?.addEventListener('click', goToNextWeek);
    clearWeekBtn?.addEventListener('click', clearWeek);
    saveAvailabilityBtn?.addEventListener('click', saveAvailability);
});
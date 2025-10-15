// Availability Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc, collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';
import { getUserGroups, getUsersByIds } from '../../shared/js/database.js';

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const backToTavernBtn = document.getElementById('back-to-tavern-btn');
const prevWeekBtn = document.getElementById('prev-week');
const nextWeekBtn = document.getElementById('next-week');
const currentWeekDisplay = document.getElementById('current-week-display');
const scheduleGridContent = document.getElementById('schedule-grid-content');
const clearWeekBtn = document.getElementById('clear-week');
const saveAvailabilityBtn = document.getElementById('save-availability');
const partyAvailabilityList = document.getElementById('party-availability-list');
const contextMenu = document.getElementById('context-menu');

let currentUser = null;
let currentWeekStart = null;
let weeklyAvailability = {};
let contextMenuTarget = null; // Store the clicked cell info

// Drag selection state
let isDragging = false;
let dragStartDay = null;
let dragStartTime = null;
let hasDragged = false;

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

// Touch device detection and mobile enhancements
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const isMobile = window.innerWidth <= 768;

// Mobile-specific event handling
function addMobileEnhancements() {
    if (isTouchDevice) {
        // Add touch-friendly class to body
        document.body.classList.add('touch-device');
        
        // Disable context menu on touch devices for time slots
        document.addEventListener('contextmenu', (e) => {
            if (e.target.classList.contains('time-slot')) {
                e.preventDefault();
            }
        });
        
        // Add scroll indicators for mobile
        const scheduleContainer = document.querySelector('.schedule-container');
        if (scheduleContainer && isMobile) {
            scheduleContainer.addEventListener('scroll', () => {
                // Optional: Add visual feedback when scrolling
                scheduleContainer.style.boxShadow = '0 4px 20px rgba(212, 175, 55, 0.3)';
                clearTimeout(scheduleContainer.scrollTimeout);
                scheduleContainer.scrollTimeout = setTimeout(() => {
                    scheduleContainer.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)';
                }, 300);
            });
        }
    }
}

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
        // Time label for this row
        gridHTML += `<div class="time-label">${timeSlot.display}</div>`;
        
        // Day slots for this time (horizontal row across all 7 days)
        for (let day = 0; day < 7; day++) {
            const slotId = `${day}-${timeIndex}`;
            gridHTML += `
                <div class="time-slot" 
                     data-day="${day}" 
                     data-time="${timeIndex}">
                </div>
            `;
        }
    });
    
    scheduleGridContent.innerHTML = gridHTML;
    
    // Add event listeners to all time slots
    const timeSlotElements = document.querySelectorAll('.time-slot');
    timeSlotElements.forEach(slot => {
        const day = parseInt(slot.dataset.day);
        const timeIndex = parseInt(slot.dataset.time);
        
        // Mouse events
        slot.addEventListener('mousedown', (e) => startDrag(e, day, timeIndex));
        slot.addEventListener('mouseenter', () => continueDrag(day, timeIndex));
        slot.addEventListener('mouseup', () => endDrag());
        slot.addEventListener('click', (e) => handleClick(e, day, timeIndex));
        slot.addEventListener('contextmenu', (e) => showContextMenu(e, day, timeIndex));
        
        // Touch events
        slot.addEventListener('touchstart', (e) => startDrag(e, day, timeIndex));
        slot.addEventListener('touchmove', (e) => handleTouchMove(e));
        slot.addEventListener('touchend', () => endDrag());
    });
    
    // Add global mouse up listener to handle drag end
    document.addEventListener('mouseup', endDrag);
    // Prevent text selection during drag
    scheduleGridContent.addEventListener('selectstart', e => e.preventDefault());
    
    // Add context menu event listeners
    setupContextMenu();
}

// Drag selection functions
function startDrag(event, day, timeIndex) {
    event.preventDefault();
    isDragging = true;
    hasDragged = false;
    dragStartDay = day;
    dragStartTime = timeIndex;
    
    // Don't automatically set the cell - let the drag or click handle it
}

function continueDrag(day, timeIndex) {
    if (!isDragging || dragStartDay !== day) return; // Only drag within the same column
    
    hasDragged = true; // Mark that we've actually dragged
    
    // Fill all cells between drag start and current position
    const startTime = Math.min(dragStartTime, timeIndex);
    const endTime = Math.max(dragStartTime, timeIndex);
    
    for (let time = startTime; time <= endTime; time++) {
        const slotKey = `${day}-${time}`;
        weeklyAvailability[slotKey] = 'available';
        updateSlotVisual(day, time);
    }
}

function endDrag() {
    isDragging = false;
    dragStartDay = null;
    dragStartTime = null;
    // Note: don't reset hasDragged here, let the click handler check it
}

function handleClick(event, day, timeIndex) {
    // Small delay to let drag operations complete
    setTimeout(() => {
        // If we just finished dragging, don't process click
        if (hasDragged) {
            hasDragged = false;
            return;
        }
        
        const slotKey = `${day}-${timeIndex}`;
        const currentState = weeklyAvailability[slotKey] || 'none';
        
        // Cycle through states: none -> available -> preferred -> unavailable -> none
        let nextState;
        switch (currentState) {
            case 'none':
                nextState = 'available';
                break;
            case 'available':
                nextState = 'preferred';
                break;
            case 'preferred':
                nextState = 'unavailable';
                break;
            case 'unavailable':
                nextState = 'none';
                break;
            default:
                nextState = 'available';
        }
        
        weeklyAvailability[slotKey] = nextState;
        updateSlotVisual(day, timeIndex);
        hasDragged = false;
    }, 10);
}

function showContextMenu(event, day, timeIndex) {
    event.preventDefault();
    
    // Store the target cell info
    contextMenuTarget = { day, timeIndex };
    
    // Get the clicked cell element for positioning
    const clickedCell = event.target;
    const cellRect = clickedCell.getBoundingClientRect();
    
    // Position the context menu to the right of the cell
    const menuX = cellRect.right + 5; // 5px margin to the right of the cell
    const menuY = cellRect.top;
    
    // Make sure the menu doesn't go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = 120; // approximate width of context menu
    const menuHeight = 160; // approximate height of context menu (4 items)
    
    let finalX = menuX;
    let finalY = menuY;
    
    // If menu would go off right edge, show it to the left of the cell
    if (menuX + menuWidth > viewportWidth) {
        finalX = cellRect.left - menuWidth - 5;
    }
    
    // If menu would go off bottom, adjust upward
    if (menuY + menuHeight > viewportHeight) {
        finalY = viewportHeight - menuHeight - 10;
    }
    
    // Make sure it doesn't go above the top
    if (finalY < 10) {
        finalY = 10;
    }
    
    contextMenu.style.left = finalX + 'px';
    contextMenu.style.top = finalY + 'px';
    contextMenu.style.display = 'block';
}

function setupContextMenu() {
    // Add click listeners to context menu items
    const menuItems = contextMenu.querySelectorAll('.context-menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const color = item.dataset.color;
            if (contextMenuTarget) {
                setConnectedCellsColor(contextMenuTarget.day, contextMenuTarget.timeIndex, color);
            }
            hideContextMenu();
        });
    });
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
}

function hideContextMenu() {
    contextMenu.style.display = 'none';
    contextMenuTarget = null;
}

function setConnectedCellsColor(day, timeIndex, newColor) {
    const slotKey = `${day}-${timeIndex}`;
    const currentState = weeklyAvailability[slotKey] || 'none';
    
    // Find all connected cells with the same color
    const connectedCells = findConnectedCellsOfSameColor(day, timeIndex, currentState);
    
    // Set all connected cells to the new color
    connectedCells.forEach(({ day: cellDay, time: cellTime }) => {
        const cellKey = `${cellDay}-${cellTime}`;
        if (newColor === 'none') {
            delete weeklyAvailability[cellKey];
        } else {
            weeklyAvailability[cellKey] = newColor;
        }
        updateSlotVisual(cellDay, cellTime);
    });
}

function findConnectedCellsOfSameColor(day, timeIndex, targetColor) {
    const visited = new Set();
    const connected = [];
    const queue = [{ day, time: timeIndex }];
    
    while (queue.length > 0) {
        const { day: currentDay, time: currentTime } = queue.shift();
        const key = `${currentDay}-${currentTime}`;
        
        if (visited.has(key)) continue;
        visited.add(key);
        
        const slotKey = `${currentDay}-${currentTime}`;
        const cellState = weeklyAvailability[slotKey] || 'none';
        
        // Only include cells that match the target color
        if (cellState !== targetColor) continue;
        
        connected.push({ day: currentDay, time: currentTime });
        
        // Check adjacent cells in the same column (up and down)
        if (currentTime > 0) {
            queue.push({ day: currentDay, time: currentTime - 1 });
        }
        if (currentTime < timeSlots.length - 1) {
            queue.push({ day: currentDay, time: currentTime + 1 });
        }
    }
    
    return connected;
}

function handleTouchMove(event) {
    if (!isDragging) return;
    
    event.preventDefault();
    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.classList.contains('time-slot')) {
        const day = parseInt(element.dataset.day);
        const timeIndex = parseInt(element.dataset.time);
        continueDrag(day, timeIndex);
    }
}

// Update slot visual appearance
function updateSlotVisual(day, timeIndex) {
    const slot = document.querySelector(`[data-day="${day}"][data-time="${timeIndex}"]`);
    if (!slot) {
        console.error('Could not find slot:', day, timeIndex);
        return;
    }
    
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

function handleBackToTavern() {
    window.location.href = '../groups/groups.html';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile enhancements
    addMobileEnhancements();
    
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
    backToTavernBtn?.addEventListener('click', handleBackToTavern);
    prevWeekBtn?.addEventListener('click', goToPreviousWeek);
    nextWeekBtn?.addEventListener('click', goToNextWeek);
    clearWeekBtn?.addEventListener('click', clearWeek);
    saveAvailabilityBtn?.addEventListener('click', saveAvailability);
});
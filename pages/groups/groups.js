// Groups Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    getDoc,
    updateDoc,
    deleteDoc,
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp,
    where,
    limit,
    enableNetwork,
    disableNetwork
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';
import { 
    createGroup, 
    joinGroup, 
    getUserGroups, 
    getGroup, 
    generateInviteLink,
    createUserProfile,
    getUserProfile
} from '../../shared/js/database.js';

// DOM Elements
const createGroupForm = document.getElementById('create-group-form');
const joinGroupForm = document.getElementById('join-group-form');
const groupsList = document.getElementById('groups-list');
const logoutBtn = document.getElementById('logout-btn');
const groupModal = document.getElementById('group-modal');
const copyLinkModal = document.getElementById('copy-link-modal');
const closeModals = document.querySelectorAll('.close');
const copyLinkBtn = document.getElementById('copy-link-btn');
const inviteLinkInput = document.getElementById('invite-link');

// Edit Group Elements
const editGroupModal = document.getElementById('edit-group-modal');
const editGroupForm = document.getElementById('edit-group-form');
const deleteGroupBtn = document.getElementById('delete-group-btn');
const membersList = document.getElementById('members-list');

// Find Available Times Elements
const findTimesModal = document.getElementById('find-times-modal');
const sessionDurationSelect = document.getElementById('session-duration');
const findAvailableTimesBtn = document.getElementById('find-available-times-btn');
const availableTimesResults = document.getElementById('available-times-results');
const timesList = document.getElementById('times-list');
const noTimesFound = document.getElementById('no-times-found');

// Connection status element
const connectionStatus = document.getElementById('connection-status');
const reconnectBtn = document.getElementById('reconnect-btn');

// Chat Elements
const partyChatSection = document.getElementById('party-chat-section');
const chatGroupSelector = document.getElementById('chat-group-selector');
const minimizeChatBtn = document.getElementById('minimize-chat');
const chatContainer = document.getElementById('chat-container');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let currentUser = null;
let currentChatGroup = null;
let currentFindTimesGroup = null;
let currentGroupId = null; // For chat functionality
let unsubscribeChat = null;
let lastSelectedGroup = localStorage.getItem('lastChatGroup');
let userGroups = [];
let isOffline = false;

// Authentication Functions
async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = '../login/login.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to log out. Please try again.');
    }
}

// Group Management Functions
async function handleCreateGroup(groupData) {
    try {
        const result = await createGroup(currentUser.uid, groupData);
        
        if (result.success) {
            showSuccess('Party created successfully! Share the ID with your friends.', createGroupForm);
            createGroupForm.reset();
            loadUserGroups();
            
            // Show invite link modal
            setTimeout(() => {
                showInviteLink(result.groupId);
            }, 1500);
        } else {
            showError(result.error, createGroupForm);
        }
    } catch (error) {
        console.error('Error creating group:', error);
        showError('Failed to create party. Please try again.', createGroupForm);
    }
}

async function handleJoinGroup(groupId) {
    try {
        const result = await joinGroup(currentUser.uid, groupId);
        
        if (result.success) {
            showSuccess('Successfully joined the party! Welcome, adventurer!', joinGroupForm);
            joinGroupForm.reset();
            loadUserGroups();
        } else {
            showError(result.error, joinGroupForm);
        }
    } catch (error) {
        console.error('Error joining group:', error);
        showError('Failed to join party. Please try again.', joinGroupForm);
    }
}

async function loadUserGroups() {
    if (!currentUser) return;
    
    try {
        const result = await getUserGroups(currentUser.uid);
        
        if (result.success) {
            userGroups = result.data;
            displayGroups(result.data);
            updateChatSelector(result.data);
            
            console.log('Last selected group from localStorage:', lastSelectedGroup);
            console.log('Available groups:', result.data.map(g => g.groupId));
            
            // Auto-select last chat group if available
            if (lastSelectedGroup && result.data.find(g => g.groupId === lastSelectedGroup)) {
                console.log('Restoring last selected group:', lastSelectedGroup);
                chatGroupSelector.value = lastSelectedGroup;
                switchToGroup(lastSelectedGroup);
            } else {
                console.log('No last selected group to restore or group not found');
            }
        } else {
            groupsList.innerHTML = '<div class="no-groups-message">Failed to load your parties.</div>';
            updateChatSelector([]);
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        
        if (error.code === 'unavailable') {
            isOffline = true;
            groupsList.innerHTML = '<div class="no-groups-message">🔌 Connection lost. Your parties will load when connection is restored.</div>';
        } else {
            groupsList.innerHTML = '<div class="no-groups-message">Failed to load your parties.</div>';
        }
        updateChatSelector([]);
    }
}

function displayGroups(groups) {
    if (groups.length === 0) {
        groupsList.innerHTML = '<div class="no-groups-message">You haven\'t joined any parties yet. Create one or join using a Party ID!</div>';
        return;
    }
    
    groupsList.innerHTML = groups.map(group => {
        const isHost = group.hostId === currentUser.uid;
        return `
        <div class="group-card">
            <h3>${group.name}</h3>
            <p>${group.description || 'No description provided'}</p>
            <div class="group-info">
                <span class="group-id">ID: ${group.groupId}</span>
                <span class="group-members">${group.members.length}/${group.maxPlayers} Players</span>
            </div>
            <div class="group-actions">
                <button class="btn-secondary" onclick="viewGroupDetails('${group.groupId}')">View Details</button>
                <button class="btn-primary" onclick="showInviteLink('${group.groupId}')">Share Link</button>
                <button class="btn-secondary" onclick="findAvailableTimes('${group.groupId}')">When can we play?</button>
                ${isHost ? `<button class="btn-secondary" onclick="editGroup('${group.groupId}')">Edit Group</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

async function showInviteLink(groupId) {
    try {
        // Get the group details to show the party name
        const result = await getGroup(groupId);
        
        if (result.success) {
            const group = result.data;
            const inviteLink = generateInviteLink(groupId);
            inviteLinkInput.value = inviteLink;
            
            // Update the modal header with party name
            const inviteMessage = document.querySelector('.invite-message');
            if (inviteMessage) {
                inviteMessage.textContent = `Join "${group.name}" and begin your adventure!`;
            }
            
            copyLinkModal.style.display = 'block';
        } else {
            // Fallback if we can't get group details
            const inviteLink = generateInviteLink(groupId);
            inviteLinkInput.value = inviteLink;
            copyLinkModal.style.display = 'block';
        }
    } catch (error) {
        console.error('Error showing invite link:', error);
        // Fallback if there's an error
        const inviteLink = generateInviteLink(groupId);
        inviteLinkInput.value = inviteLink;
        copyLinkModal.style.display = 'block';
    }
}

async function viewGroupDetails(groupId) {
    try {
        const result = await getGroup(groupId);
        
        if (result.success) {
            const group = result.data;
            document.getElementById('group-details').innerHTML = `
                <h2>${group.name}</h2>
                <div class="group-detail-info">
                    <p><strong>Party ID:</strong> ${group.groupId}</p>
                    <p><strong>Host:</strong> ${group.hostId}</p>
                    <p><strong>Players:</strong> ${group.members.length}/${group.maxPlayers}</p>
                    <p><strong>Description:</strong> ${group.description || 'No description'}</p>
                    <p><strong>Created:</strong> ${group.createdAt ? new Date(group.createdAt.toDate()).toLocaleDateString() : 'Unknown'}</p>
                </div>
                <div class="group-members-list">
                    <h3>Party Members</h3>
                    <div class="members-grid">
                        ${group.members.map(memberId => `
                            <div class="member-card">
                                <div class="member-info">
                                    <span class="member-id">${memberId}</span>
                                    ${memberId === group.hostId ? '<span class="host-badge">Host</span>' : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
            groupModal.style.display = 'block';
        } else {
            alert('Failed to load group details');
        }
    } catch (error) {
        console.error('Error viewing group details:', error);
        alert('Failed to load group details');
    }
}

// Chat Functions
function updateOfflineStatus() {
    console.log('updateOfflineStatus called, isOffline:', isOffline);
    
    if (isOffline) {
        // Update connection status indicator
        if (connectionStatus) {
            connectionStatus.textContent = '🔴';
            connectionStatus.className = 'connection-status offline';
            connectionStatus.title = 'Offline - Check your connection';
        }
        
        // Show reconnect button
        if (reconnectBtn) {
            reconnectBtn.style.display = 'inline-block';
        }
        
        // Only disable input if we have a current chat group
        if (currentChatGroup && chatInput) {
            chatInput.placeholder = '🔌 Offline - Check your connection';
            chatInput.disabled = true;
            const submitButton = chatForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = true;
            }
        }
        
        // Show offline indicator in chat
        if (currentChatGroup && chatMessages) {
            const offlineMessage = document.createElement('div');
            offlineMessage.className = 'offline-indicator';
            offlineMessage.innerHTML = '🔌 You are currently offline. Messages will load when connection is restored. <button onclick="manualReconnect()" style="margin-left: 10px; padding: 5px 10px; background: orange; border: none; border-radius: 3px; color: white; cursor: pointer;">Try Reconnect</button>';
            offlineMessage.style.cssText = `
                background: rgba(255, 165, 0, 0.2);
                border: 1px solid orange;
                padding: 10px;
                margin: 10px;
                border-radius: 5px;
                text-align: center;
                color: orange;
            `;
            
            // Add to top of chat messages if not already present
            if (!document.querySelector('.offline-indicator')) {
                chatMessages.insertBefore(offlineMessage, chatMessages.firstChild);
            }
        }
    } else {
        // Update connection status indicator
        if (connectionStatus) {
            connectionStatus.textContent = '🟢';
            connectionStatus.className = 'connection-status online';
            connectionStatus.title = 'Connected';
        }
        
        // Hide reconnect button
        if (reconnectBtn) {
            reconnectBtn.style.display = 'none';
        }
        
        // Only enable input if we have a current chat group
        if (currentChatGroup && chatInput) {
            chatInput.placeholder = 'Type your message...';
            chatInput.disabled = false;
            chatInput.style.pointerEvents = 'auto';
            chatInput.style.cursor = 'text';
            const submitButton = chatForm.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = false;
            }
            console.log('Input re-enabled due to online status');
        }
        
        // Remove offline indicator
        const offlineIndicator = document.querySelector('.offline-indicator');
        if (offlineIndicator) {
            offlineIndicator.remove();
        }
    }
}

function listenToMessages() {
    if (!currentChatGroup) {
        console.log('No current chat group selected');
        return;
    }
    
    console.log('Setting up message listener for group:', currentChatGroup);
    
    // Unsubscribe from previous chat if any
    if (unsubscribeChat) {
        unsubscribeChat();
    }
    
    const messagesRef = collection(db, 'groups', currentChatGroup, 'messages');
    // Query for messages ordered by timestamp descending, limit to 40 most recent
    const q = query(
        messagesRef, 
        orderBy('timestamp', 'desc'), 
        limit(40)
    );
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        console.log('Received message snapshot, size:', snapshot.size);
        
        // Connection is working if we're receiving snapshots
        if (isOffline) {
            isOffline = false;
            updateOfflineStatus();
            console.log('Connection restored!');
        }
        
        const messages = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            console.log('Message data:', data);
            // Include all messages, even ones without timestamp for debugging
            messages.push({ id: doc.id, ...data });
        });
        
        // Sort messages by timestamp ascending (oldest first) for display
        messages.sort((a, b) => {
            // Handle messages without timestamp
            if (!a.timestamp && !b.timestamp) return 0;
            if (!a.timestamp) return -1;
            if (!b.timestamp) return 1;
            return a.timestamp.toDate() - b.timestamp.toDate();
        });
        
        console.log('Displaying', messages.length, 'messages');
        displayChatMessages(messages);
    }, (error) => {
        console.error('Error listening to messages:', error);
        
        if (error.code === 'unavailable') {
            console.log('Firestore is offline');
            isOffline = true;
            updateOfflineStatus();
            chatMessages.innerHTML = '<div class="no-messages">🔌 Connection lost. Trying to reconnect...</div>';
        } else {
            chatMessages.innerHTML = '<div class="no-messages">Failed to load messages. Check console for details.</div>';
        }
    });
}

function displayChatMessages(messages) {
    console.log('displayChatMessages called with', messages.length, 'messages');
    
    if (messages.length === 0) {
        chatMessages.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
        return;
    }
    
    let messagesHtml = '';
    
    // If we have exactly 40 messages, show indicator that there are older messages
    if (messages.length === 40) {
        messagesHtml += `
            <div class="older-messages-indicator">
                <small>📜 Showing last 40 messages • Older messages not displayed</small>
            </div>
        `;
    }
    
    messagesHtml += messages.map(message => {
        const isOwnMessage = currentUser && message.userId === currentUser.uid;
        
        // Format timestamp to show small, readable time
        let messageTime = 'Sending...';
        if (message.timestamp) {
            const date = new Date(message.timestamp.toDate());
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            
            if (messageDate.getTime() === today.getTime()) {
                // Today: show just time
                messageTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else if (now - messageDate < 7 * 24 * 60 * 60 * 1000) {
                // This week: show day and time
                messageTime = date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
                             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } else {
                // Older: show date and time
                messageTime = date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
                             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
        }
        
        return `
            <div class="message ${isOwnMessage ? 'own-message' : ''}">
                <div class="message-header">
                    <span class="message-author">${message.userName || 'Anonymous'}</span>
                    <span class="message-time">${messageTime}</span>
                </div>
                <div class="message-content">${escapeHtml(message.content)}</div>
            </div>
        `;
    }).join('');
    
    console.log('Setting innerHTML with', messagesHtml.length, 'characters');
    chatMessages.innerHTML = messagesHtml;
    
    // Scroll to bottom of messages
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage(content) {
    console.log('sendMessage called with:', content);
    console.log('currentGroupId:', currentGroupId);
    console.log('currentUser:', currentUser);
    console.log('isOffline:', isOffline);
    
    if (!currentGroupId || !currentUser || !content.trim()) {
        console.log('sendMessage aborted: missing requirements');
        return;
    }
    
    if (isOffline) {
        showError('You are currently offline. Message will be sent when connection is restored.');
        return;
    }
    
    try {
        console.log('Attempting to send message...');
        
        // Get current user's profile to get username
        const userResult = await getUserProfile(currentUser.uid);
        const userName = userResult.success && userResult.data.username ? 
            userResult.data.username : 
            currentUser.email.split('@')[0];
        
        console.log('Using username:', userName);
        
        const messagesRef = collection(db, 'groups', currentGroupId, 'messages');
        const newMessage = {
            content: content.trim(),
            userId: currentUser.uid,
            userName: userName,
            timestamp: serverTimestamp()
        };
        
        console.log('Adding message to Firestore:', newMessage);
        await addDoc(messagesRef, newMessage);
        
        console.log('Message sent successfully');
        
        // Clear input
        chatInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        
        if (error.code === 'unavailable') {
            showError('Connection lost. Please check your internet connection and try again.');
            isOffline = true;
            updateOfflineStatus();
        } else {
            showError('Failed to send message. Please try again.');
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// New persistent chat functions
function updateChatSelector(groups) {
    // Clear existing options except the default
    chatGroupSelector.innerHTML = '<option value="">Select a party to chat...</option>';
    
    // Add groups to selector
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.groupId;
        option.textContent = group.name;
        chatGroupSelector.appendChild(option);
    });
}

function switchToGroup(groupId) {
    console.log('switchToGroup called with:', groupId);
    
    if (!groupId) {
        currentChatGroup = null;
        currentGroupId = null;
        if (unsubscribeChat) {
            unsubscribeChat();
            unsubscribeChat = null;
        }
        
        chatMessages.innerHTML = '<div class="no-chat-selected"><p>👆 Select a party from the dropdown to start chatting!</p></div>';
        chatInput.disabled = true;
        chatInput.placeholder = 'Select a party to start chatting...';
        const submitButton = chatForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = true;
        }
        return;
    }

    // Save last selected group
    lastSelectedGroup = groupId;
    localStorage.setItem('lastChatGroup', groupId);
    
    // Switch to the selected group chat
    if (currentChatGroup !== groupId) {
        if (unsubscribeChat) {
            unsubscribeChat();
        }
        
        currentChatGroup = groupId;
        currentGroupId = groupId; // For compatibility with existing chat functions
        
        console.log('Switching to group:', groupId);
        console.log('Chat input element:', chatInput);
        console.log('Chat form element:', chatForm);
        
        // Show loading state
        chatMessages.innerHTML = '<div class="loading-messages">📜 Loading messages...</div>';
        
        // Force enable input (don't check offline status here)
        if (chatInput) {
            chatInput.disabled = false;
            chatInput.placeholder = 'Type your message...';
            chatInput.style.pointerEvents = 'auto'; // Ensure pointer events work
            chatInput.style.cursor = 'text'; // Show text cursor
            console.log('Chat input enabled. Disabled status:', chatInput.disabled);
        }
        
        const submitButton = chatForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = false;
            console.log('Submit button enabled. Disabled status:', submitButton.disabled);
        }
        
        // Test if input is clickable
        setTimeout(() => {
            if (chatInput) {
                chatInput.focus();
                console.log('Attempted to focus input after 500ms');
            }
        }, 500);
        
        // Start listening to messages
        listenToMessages();
    }
}

function toggleChatMinimize() {
    const isMinimized = chatContainer.classList.contains('minimized');
    
    if (isMinimized) {
        chatContainer.classList.remove('minimized');
        minimizeChatBtn.textContent = '−';
    } else {
        chatContainer.classList.add('minimized');
        minimizeChatBtn.textContent = '+';
    }
}

// Make functions global for onclick handlers
window.viewGroupDetails = viewGroupDetails;
window.showInviteLink = showInviteLink;
window.editGroup = editGroup;
window.removeMember = removeMember;

// Edit Group Functions
let currentEditGroupId = null;

}

// Find Available Times Modal Functions
async function findAvailableTimes(groupId) {
    currentFindTimesGroup = groupId;
    
    try {
        const result = await getGroup(groupId);
        if (!result.success) {
            showError('Failed to load group details');
            return;
        }
        
        const group = result.data;
        
        // Update modal header with group name
        const findTimesMessage = document.querySelector('.find-times-message');
        if (findTimesMessage) {
            findTimesMessage.textContent = `Find available time slots for "${group.name}"`;
        }
        
        // Reset results
        availableTimesResults.style.display = 'none';
        noTimesFound.style.display = 'none';
        
        // Show modal
        findTimesModal.style.display = 'block';
    } catch (error) {
        console.error('Error loading group for finding times:', error);
        showError('Failed to load group details');
    }
}

// Make functions globally accessible for onclick handlers
window.findAvailableTimes = findAvailableTimes;

async function searchAvailableTimes() {
    if (!currentFindTimesGroup) return;
    
    const sessionDuration = parseInt(sessionDurationSelect.value);
    
    try {
        addLoadingState(findAvailableTimesBtn);
        
        // Get group details and members
        const groupResult = await getGroup(currentFindTimesGroup);
        if (!groupResult.success) {
            showError('Failed to load group details');
            return;
        }
        
        const group = groupResult.data;
        const memberIds = group.members;
        
        // Get current week start (Sunday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - dayOfWeek);
        currentWeekStart.setHours(0, 0, 0, 0);
        
        // Get availability for all members for this week
        const weekId = currentWeekStart.toISOString().split('T')[0];
        const memberAvailabilities = {};
        
        for (const memberId of memberIds) {
            try {
                const availabilityRef = doc(db, 'availability', `${memberId}_${weekId}`);
                const availabilitySnap = await getDoc(availabilityRef);
                
                if (availabilitySnap.exists()) {
                    memberAvailabilities[memberId] = availabilitySnap.data().availability || {};
                } else {
                    memberAvailabilities[memberId] = {};
                }
            } catch (error) {
                console.error(`Error loading availability for member ${memberId}:`, error);
                memberAvailabilities[memberId] = {};
            }
        }
        
        // Find available time blocks
        const availableBlocks = findAvailableTimeBlocks(memberAvailabilities, memberIds, sessionDuration);
        
        // Display results
        if (availableBlocks.length > 0) {
            displayAvailableTimeBlocks(availableBlocks, currentWeekStart);
            availableTimesResults.style.display = 'block';
            noTimesFound.style.display = 'none';
        } else {
            availableTimesResults.style.display = 'none';
            noTimesFound.style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error searching for available times:', error);
        showError('Failed to search for available times. Please try again.');
    } finally {
        removeLoadingState(findAvailableTimesBtn, 'Find Available Times');
    }
}

function findAvailableTimeBlocks(memberAvailabilities, memberIds, sessionDurationHours) {
    const availableBlocks = [];
    const slotsNeeded = sessionDurationHours * 2; // 2 slots per hour (30-minute slots)
    
    // Check each day of the week
    for (let day = 0; day < 7; day++) {
        // Check each possible starting time slot
        for (let startTime = 0; startTime <= 48 - slotsNeeded; startTime++) {
            let allAvailable = true;
            let hasPreferred = false;
            
            // Check if all members are available for this time block
            for (let slot = startTime; slot < startTime + slotsNeeded; slot++) {
                const slotKey = `${day}-${slot}`;
                
                for (const memberId of memberIds) {
                    const availability = memberAvailabilities[memberId][slotKey];
                    
                    // If any member is unavailable or has no availability set, this block is not available
                    if (!availability || availability === 'unavailable') {
                        allAvailable = false;
                        break;
                    }
                    
                    // Check if this slot is preferred by any member
                    if (availability === 'preferred') {
                        hasPreferred = true;
                    }
                }
                
                if (!allAvailable) break;
            }
            
            if (allAvailable) {
                availableBlocks.push({
                    day,
                    startTime,
                    endTime: startTime + slotsNeeded,
                    isPreferred: hasPreferred
                });
            }
        }
    }
    
    // Sort blocks: preferred first, then by day and time
    availableBlocks.sort((a, b) => {
        if (a.isPreferred && !b.isPreferred) return -1;
        if (!a.isPreferred && b.isPreferred) return 1;
        if (a.day !== b.day) return a.day - b.day;
        return a.startTime - b.startTime;
    });
    
    return availableBlocks;
}

function displayAvailableTimeBlocks(blocks, weekStart) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    timesList.innerHTML = blocks.map(block => {
        const startTime = formatTimeSlot(block.startTime);
        const endTime = formatTimeSlot(block.endTime);
        const dayName = daysOfWeek[block.day];
        
        // Get the actual date for this day
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + block.day);
        const dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        return `
            <div class="time-slot-result ${block.isPreferred ? 'preferred' : ''}">
                <div class="time-info">
                    <div class="time-day">${dayName}, ${dateString}</div>
                    <div class="time-range">${startTime} - ${endTime}</div>
                </div>
                <div class="time-type ${block.isPreferred ? 'preferred' : 'available'}">
                    ${block.isPreferred ? 'Preferred' : 'Available'}
                </div>
            </div>
        `;
    }).join('');
}

function formatTimeSlot(slotIndex) {
    const hour = Math.floor(slotIndex / 2);
    const minute = (slotIndex % 2) * 30;
    const time = new Date();
    time.setHours(hour, minute, 0, 0);
    return time.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
    });
}

async function editGroup(groupId) {
    currentEditGroupId = groupId;
    
    try {
        const result = await getGroup(groupId);
        if (!result.success) {
            showError('Failed to load group details');
            return;
        }
        
        const group = result.data;
        
        // Populate form fields
        document.getElementById('edit-group-name').value = group.name;
        document.getElementById('edit-group-description').value = group.description || '';
        document.getElementById('edit-max-players').value = group.maxPlayers;
        
        // Load members
        await loadGroupMembers(group);
        
        // Show modal
        editGroupModal.style.display = 'block';
    } catch (error) {
        console.error('Error loading group for editing:', error);
        showError('Failed to load group details');
    }
}

async function loadGroupMembers(group) {
    try {
        const members = await getUsersByIds(group.members);
        
        membersList.innerHTML = members.map(member => {
            const isHost = member.uid === group.hostId;
            const isCurrentUser = member.uid === currentUser.uid;
            
            return `
                <div class="member-item">
                    <div class="member-info">
                        ${member.username || member.email}
                        ${isHost ? '<span class="member-role">HOST</span>' : ''}
                    </div>
                    ${!isHost && !isCurrentUser ? 
                        `<button class="remove-member-btn" onclick="removeMember('${member.uid}')">Remove</button>` : 
                        ''
                    }
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading members:', error);
        membersList.innerHTML = '<div class="member-item">Failed to load members</div>';
    }
}

async function removeMember(userId) {
    if (!confirm('Are you sure you want to remove this member from the party?')) {
        return;
    }
    
    try {
        const groupRef = doc(db, 'groups', currentEditGroupId);
        const groupDoc = await getDoc(groupRef);
        
        if (groupDoc.exists()) {
            const group = groupDoc.data();
            const updatedMembers = group.members.filter(id => id !== userId);
            
            await updateDoc(groupRef, {
                members: updatedMembers
            });
            
            // Reload the group data and refresh the modal
            const result = await getGroup(currentEditGroupId);
            if (result.success) {
                await loadGroupMembers(result.data);
            }
            
            showSuccess('Member removed successfully');
        }
    } catch (error) {
        console.error('Error removing member:', error);
        showError('Failed to remove member');
    }
}

async function updateGroup() {
    if (!currentEditGroupId) {
        console.error('No group ID set for editing');
        showError('No group selected for editing');
        return;
    }
    
    console.log('Updating group:', currentEditGroupId);
    
    try {
        const name = document.getElementById('edit-group-name').value.trim();
        const description = document.getElementById('edit-group-description').value.trim();
        const maxPlayers = parseInt(document.getElementById('edit-max-players').value);
        
        console.log('Form values:', { name, description, maxPlayers });
        
        if (!name) {
            showError('Party name is required');
            return;
        }
        
        const groupRef = doc(db, 'groups', currentEditGroupId);
        console.log('Updating document:', groupRef.path);
        
        await updateDoc(groupRef, {
            name,
            description,
            maxPlayers
        });
        
        console.log('Group updated successfully');
        showSuccess('Party updated successfully');
        editGroupModal.style.display = 'none';
        
        // Refresh the groups list
        await loadUserGroups();
    } catch (error) {
        console.error('Error updating group:', error);
        showError('Failed to update party: ' + error.message);
    }
}

async function deleteGroup() {
    if (!currentEditGroupId) return;
    
    const confirmText = prompt('Are you sure you want to delete this party? This action cannot be undone. Type "DELETE" to confirm:');
    
    if (confirmText !== 'DELETE') {
        return;
    }
    
    try {
        // Delete the group document
        await deleteDoc(doc(db, 'groups', currentEditGroupId));
        
        showSuccess('Party deleted successfully');
        editGroupModal.style.display = 'none';
        
        // Refresh the groups list
        await loadUserGroups();
    } catch (error) {
        console.error('Error deleting group:', error);
        showError('Failed to delete party');
    }
}

// Utility Functions
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        copyLinkBtn.textContent = 'Copied!';
        copyLinkBtn.style.background = 'linear-gradient(45deg, #22c55e, #86efac)';
        
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link';
            copyLinkBtn.style.background = '';
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        inviteLinkInput.select();
        document.execCommand('copy');
        copyLinkBtn.textContent = 'Copied!';
        
        setTimeout(() => {
            copyLinkBtn.textContent = 'Copy Link';
        }, 2000);
    });
}

// Manual reconnect function - make it global so it can be called from onclick
window.manualReconnect = async function() {
    console.log('Manual reconnect attempt...');
    try {
        // Try to enable network
        await enableNetwork(db);
        console.log('Network enabled, testing connection...');
        
        // Test with a simple operation
        if (window.testFirebaseConnection) {
            const result = await window.testFirebaseConnection();
            if (result) {
                isOffline = false;
                updateOfflineStatus();
                console.log('✅ Reconnection successful!');
                
                // Restart chat if we have a current group
                if (currentChatGroup) {
                    listenToMessages();
                }
                
                // Reload groups
                if (currentUser) {
                    loadUserGroups();
                }
            } else {
                console.log('❌ Connection test failed');
                alert('Still unable to connect. Please check your internet connection.');
            }
        }
    } catch (error) {
        console.error('Error during manual reconnect:', error);
        alert('Reconnection failed: ' + error.message);
    }
};

// Force enable chat input function
window.forceEnableChatInput = function() {
    console.log('Force enabling chat input...');
    
    if (!chatInput) {
        console.error('Chat input element not found!');
        return false;
    }
    
    // Force enable the input
    chatInput.disabled = false;
    chatInput.style.pointerEvents = 'auto';
    chatInput.style.cursor = 'text';
    chatInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    chatInput.placeholder = 'Type your message...';
    
    // Enable submit button
    const submitButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;
    if (submitButton) {
        submitButton.disabled = false;
    }
    
    // Try to focus
    setTimeout(() => {
        chatInput.focus();
        console.log('Input focus attempted');
    }, 100);
    
    console.log('Chat input force enabled');
    return true;
};

// Add debug function to test input state
window.debugChatInput = function() {
    console.log('=== CHAT INPUT DEBUG ===');
    console.log('Chat input element:', chatInput);
    console.log('Input disabled:', chatInput ? chatInput.disabled : 'element not found');
    console.log('Input value:', chatInput ? chatInput.value : 'N/A');
    console.log('Input placeholder:', chatInput ? chatInput.placeholder : 'N/A');
    console.log('Input style.pointerEvents:', chatInput ? chatInput.style.pointerEvents : 'N/A');
    console.log('Input style.cursor:', chatInput ? chatInput.style.cursor : 'N/A');
    console.log('Current chat group:', currentChatGroup);
    console.log('Current group ID:', currentGroupId);
    console.log('Is offline:', isOffline);
    console.log('Current user:', currentUser ? currentUser.uid : 'Not logged in');
    
    if (chatInput) {
        console.log('Attempting to focus input...');
        chatInput.focus();
        console.log('Active element after focus:', document.activeElement);
        console.log('Is input focused?', document.activeElement === chatInput);
    }
    
    const submitButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;
    console.log('Submit button:', submitButton);
    console.log('Submit button disabled:', submitButton ? submitButton.disabled : 'button not found');
    
    return {
        element: chatInput,
        disabled: chatInput ? chatInput.disabled : null,
        focused: document.activeElement === chatInput,
        currentGroup: currentChatGroup,
        offline: isOffline
    };
};

// Comprehensive Firebase diagnostic function
window.diagnoseFirebase = async function() {
    console.log('🔍 FIREBASE DIAGNOSTIC REPORT');
    console.log('================================');
    
    // 1. Basic connectivity
    console.log('1. Network Status:');
    console.log('   - Browser online:', navigator.onLine);
    console.log('   - Current URL:', window.location.href);
    
    // 2. Firebase config
    console.log('2. Firebase Configuration:');
    console.log('   - Auth domain:', auth.app.options.authDomain);
    console.log('   - Project ID:', auth.app.options.projectId);
    
    // 3. Authentication status
    console.log('3. Authentication:');
    console.log('   - Current user:', currentUser ? currentUser.uid : 'Not logged in');
    console.log('   - Auth state:', auth.currentUser ? 'Authenticated' : 'Not authenticated');
    
    // 4. Try various Firebase operations
    console.log('4. Firebase Operations Test:');
    
    try {
        console.log('   Testing: Enable network...');
        await enableNetwork(db);
        console.log('   ✅ Network enabled');
        
        console.log('   Testing: Simple read operation...');
        const testRef = doc(db, 'test', 'diagnostic');
        const testSnap = await getDoc(testRef);
        console.log('   ✅ Read operation successful (document exists:', testSnap.exists(), ')');
        
        console.log('   Testing: User groups access...');
        if (currentUser) {
            const userResult = await getUserProfile(currentUser.uid);
            console.log('   ✅ User profile access:', userResult.success ? 'Success' : 'Failed - ' + userResult.error);
        } else {
            console.log('   ⚠️ Skipped - no current user');
        }
        
        console.log('✅ All Firebase operations successful!');
        return true;
        
    } catch (error) {
        console.log('❌ Firebase operation failed:', error);
        console.log('   Error code:', error.code);
        console.log('   Error message:', error.message);
        
        // Specific error guidance
        if (error.code === 'permission-denied') {
            console.log('💡 LIKELY CAUSE: Firestore security rules are blocking access');
            console.log('   Check your Firestore rules in Firebase Console');
        } else if (error.code === 'unavailable') {
            console.log('💡 LIKELY CAUSE: Network connectivity issue');
            console.log('   Check internet connection, firewall, or proxy settings');
        } else if (error.code === 'unauthenticated') {
            console.log('💡 LIKELY CAUSE: User not properly authenticated');
            console.log('   Check authentication flow');
        }
        
        return false;
    }
};

// Network connectivity detection
window.addEventListener('online', () => {
    console.log('Browser reports: back online');
    isOffline = false;
    updateOfflineStatus();
    
    // Try to reconnect to Firestore
    if (currentChatGroup) {
        console.log('Attempting to reconnect chat...');
        listenToMessages();
    }
});

window.addEventListener('offline', () => {
    console.log('Browser reports: went offline');
    isOffline = true;
    updateOfflineStatus();
});

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== FIREBASE DEBUG INFO ===');
    console.log('Firebase auth:', auth);
    console.log('Firebase db:', db);
    console.log('Current URL:', window.location.href);
    console.log('Navigator online:', navigator.onLine);
    
    // Test Firebase connection on page load
    if (window.testFirebaseConnection) {
        window.testFirebaseConnection().then(result => {
            console.log('Firebase connection test result:', result);
            if (!result) {
                console.log('📋 Firebase connection failed! Running full diagnostic...');
                window.diagnoseFirebase();
                console.log('💡 TROUBLESHOOTING COMMANDS:');
                console.log('   - diagnoseFirebase() - Run full diagnostic');
                console.log('   - debugChatInput() - Debug chat input state');
                console.log('   - forceEnableChatInput() - Force enable input');
                console.log('   - manualReconnect() - Try to reconnect');
                console.log('   - Check Firebase Console for your project');
                console.log('   - Check browser Network tab for failed requests');
            }
        });
    }
    
    // Initialize chat input state
    setTimeout(() => {
        if (chatInput) {
            console.log('Initializing chat input state...');
            chatInput.style.pointerEvents = 'auto';
            chatInput.style.cursor = 'text';
            console.log('Chat input initialized');
        }
    }, 1000);
    
    // Periodic check to ensure input stays enabled when it should be
    setInterval(() => {
        if (currentChatGroup && chatInput && chatInput.disabled && !isOffline) {
            console.log('🔧 Auto-fixing disabled chat input...');
            window.forceEnableChatInput();
        }
    }, 5000); // Check every 5 seconds
    
    // Auth state listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('User is signed in:', user);
            
            // Ensure user profile exists in Firestore
            try {
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    lastLogin: new Date()
                }, { merge: true });
            } catch (error) {
                console.error('Error updating user profile:', error);
            }
            
            loadUserGroups();
        } else {
            window.location.href = '../login/login.html';
        }
    });
    
    // Form event listeners
    createGroupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const groupName = document.getElementById('group-name').value;
        const groupDescription = document.getElementById('group-description').value;
        const maxPlayers = parseInt(document.getElementById('max-players').value);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        addLoadingState(submitBtn);
        
        const groupData = {
            name: groupName,
            description: groupDescription,
            maxPlayers: maxPlayers
        };
        
        await handleCreateGroup(groupData);
        
        removeLoadingState(submitBtn, originalText);
    });
    
    joinGroupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const groupId = document.getElementById('group-id').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        if (!/^\d{6}$/.test(groupId)) {
            showError('Please enter a valid 6-digit Party ID.', joinGroupForm);
            return;
        }
        
        addLoadingState(submitBtn);
        
        await handleJoinGroup(groupId);
        
        removeLoadingState(submitBtn, originalText);
    });
    
    // Button event listeners
    logoutBtn?.addEventListener('click', handleLogout);
    
    copyLinkBtn?.addEventListener('click', () => {
        copyToClipboard(inviteLinkInput.value);
    });
    
    // Chat event listeners
    closeChatBtn?.addEventListener('click', closePartyChat);
    
    chatForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Chat form submitted');
        const content = chatInput.value.trim();
        console.log('Message content:', content);
        if (content) {
            await sendMessage(content);
        }
    });
    
    // Add click event listener to chat input for debugging
    chatInput?.addEventListener('click', (e) => {
        console.log('Chat input clicked');
        console.log('Input disabled:', chatInput.disabled);
        console.log('Current chat group:', currentChatGroup);
        console.log('Event target:', e.target);
        console.log('Event current target:', e.currentTarget);
        
        // If input is disabled but we have a chat group, force enable it
        if (chatInput.disabled && currentChatGroup) {
            console.log('Input was disabled but we have a chat group, force enabling...');
            window.forceEnableChatInput();
        }
    });
    
    // Add focus event listener for debugging
    chatInput?.addEventListener('focus', () => {
        console.log('Chat input focused');
    });
    
    // Add event listener to detect when input gets disabled
    if (chatInput) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'disabled') {
                    console.log('Chat input disabled state changed:', chatInput.disabled);
                    console.log('Current chat group when disabled changed:', currentChatGroup);
                    
                    // If input got disabled but we have a chat group, log warning
                    if (chatInput.disabled && currentChatGroup) {
                        console.warn('⚠️ Chat input was disabled while having a chat group!');
                        console.log('Call forceEnableChatInput() to fix this');
                    }
                }
            });
        });
        
        observer.observe(chatInput, { attributes: true });
    }
    
    // Modal event listeners
    closeModals.forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Edit Group Modal event listeners
    editGroupForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('Edit form submitted');
        await updateGroup();
    });
    
    deleteGroupBtn?.addEventListener('click', async () => {
        console.log('Delete button clicked');
        await deleteGroup();
    });
    
    // Find Available Times Modal event listeners
    findAvailableTimesBtn?.addEventListener('click', searchAvailableTimes);
    
    // Reconnect button event listener
    reconnectBtn?.addEventListener('click', window.manualReconnect);
    
    // Chat event listeners
    chatGroupSelector?.addEventListener('change', (e) => {
        const selectedGroupId = e.target.value;
        switchToGroup(selectedGroupId);
    });
    
    minimizeChatBtn?.addEventListener('click', () => {
        toggleChatMinimize();
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});
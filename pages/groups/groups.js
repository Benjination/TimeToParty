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
    where
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

// Chat Elements
const partyChatSection = document.getElementById('party-chat-section');
const chatPartyName = document.getElementById('chat-party-name');
const closeChatBtn = document.getElementById('close-chat');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

let currentUser = null;
let currentGroupId = null;
let unsubscribeChat = null;

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
            displayGroups(result.data);
        } else {
            groupsList.innerHTML = '<div class="no-groups-message">Failed to load your parties.</div>';
        }
    } catch (error) {
        console.error('Error loading groups:', error);
        groupsList.innerHTML = '<div class="no-groups-message">Failed to load your parties.</div>';
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
                <button class="btn-primary" onclick="openPartyChat('${group.groupId}', '${group.name}')">Party Chat</button>
                <button class="btn-primary" onclick="showInviteLink('${group.groupId}')">Share Link</button>
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
async function openPartyChat(groupId, groupName) {
    currentGroupId = groupId;
    chatPartyName.textContent = `${groupName} - Party Chat`;
    partyChatSection.style.display = 'block';
    
    // Scroll to chat section
    partyChatSection.scrollIntoView({ behavior: 'smooth' });
    
    // Subscribe to chat messages
    subscribeToChat(groupId);
}

function closePartyChat() {
    partyChatSection.style.display = 'none';
    currentGroupId = null;
    
    // Unsubscribe from chat messages
    if (unsubscribeChat) {
        unsubscribeChat();
        unsubscribeChat = null;
    }
}

function subscribeToChat(groupId) {
    // Unsubscribe from previous chat if any
    if (unsubscribeChat) {
        unsubscribeChat();
    }
    
    const messagesRef = collection(db, 'groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    unsubscribeChat = onSnapshot(q, (snapshot) => {
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        displayChatMessages(messages);
    }, (error) => {
        console.error('Error listening to messages:', error);
        chatMessages.innerHTML = '<div class="no-messages">Failed to load messages.</div>';
    });
}

function displayChatMessages(messages) {
    if (messages.length === 0) {
        chatMessages.innerHTML = '<div class="no-messages">No messages yet. Start the conversation!</div>';
        return;
    }
    
    chatMessages.innerHTML = messages.map(message => {
        const isOwnMessage = message.userId === currentUser.uid;
        const messageTime = message.timestamp ? 
            new Date(message.timestamp.toDate()).toLocaleString() : 
            'Sending...';
        
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
    
    // Scroll to bottom of messages
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function sendMessage(content) {
    if (!currentGroupId || !currentUser || !content.trim()) {
        return;
    }
    
    try {
        // Get current user's profile to get username
        const userResult = await getUserProfile(currentUser.uid);
        const userName = userResult.success && userResult.data.username ? 
            userResult.data.username : 
            currentUser.email.split('@')[0];
        
        const messagesRef = collection(db, 'groups', currentGroupId, 'messages');
        await addDoc(messagesRef, {
            content: content.trim(),
            userId: currentUser.uid,
            userName: userName,
            timestamp: serverTimestamp()
        });
        
        // Clear input
        chatInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make functions global for onclick handlers
window.viewGroupDetails = viewGroupDetails;
window.showInviteLink = showInviteLink;
window.openPartyChat = openPartyChat;
window.editGroup = editGroup;
window.removeMember = removeMember;

// Edit Group Functions
let currentEditGroupId = null;

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

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
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
        const content = chatInput.value.trim();
        if (content) {
            await sendMessage(content);
        }
    });
    
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
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});
// Groups Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';
import { 
    createGroup, 
    joinGroup, 
    getUserGroups, 
    getGroup, 
    generateInviteLink,
    createUserProfile 
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

let currentUser = null;

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
    
    groupsList.innerHTML = groups.map(group => `
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
            </div>
        </div>
    `).join('');
}

function showInviteLink(groupId) {
    const inviteLink = generateInviteLink(groupId);
    inviteLinkInput.value = inviteLink;
    copyLinkModal.style.display = 'block';
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

// Make functions global for onclick handlers
window.viewGroupDetails = viewGroupDetails;
window.showInviteLink = showInviteLink;

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
    
    // Modal event listeners
    closeModals.forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
});
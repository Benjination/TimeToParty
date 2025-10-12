// Friends Page JavaScript
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { auth, db } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';
import { getUserFriends, addFriend, getUserGroups, getUserByEmail, getUsersByIds } from '../../shared/js/database.js';

// DOM Elements
const logoutBtn = document.getElementById('logout-btn');
const friendsList = document.getElementById('friends-list');
const addFriendForm = document.getElementById('add-friend-form');
const partyMembersList = document.getElementById('party-members-list');

let currentUser = null;

// Add friend by email
async function handleAddFriend(email) {
    if (email === currentUser.email) {
        showError("You can't add yourself as a friend!", addFriendForm);
        return;
    }
    
    try {
        // Find user by email
        const friendResult = await getUserByEmail(email);
        
        if (!friendResult.success) {
            showError('No user found with that email address.', addFriendForm);
            return;
        }
        
        const friendUser = friendResult.data;
        
        // Check if already friends
        const friendsResult = await getUserFriends(currentUser.uid);
        if (friendsResult.success && friendsResult.data.some(friend => friend.id === friendUser.id)) {
            showError('You are already friends with this user!', addFriendForm);
            return;
        }
        
        // Add friend (mutual)
        await addFriend(currentUser.uid, friendUser.id);
        await addFriend(friendUser.id, currentUser.uid);
        
        showSuccess(`Successfully added ${friendUser.username || friendUser.email} as a friend!`, addFriendForm);
        addFriendForm.reset();
        loadFriends();
        
    } catch (error) {
        console.error('Error adding friend:', error);
        showError('Failed to add friend. Please try again.', addFriendForm);
    }
}

// Load and display friends
async function loadFriends() {
    if (!currentUser) return;
    
    try {
        const result = await getUserFriends(currentUser.uid);
        
        if (result.success) {
            displayFriends(result.data);
        } else {
            friendsList.innerHTML = '<div class="no-friends-message">Failed to load friends.</div>';
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friendsList.innerHTML = '<div class="no-friends-message">Failed to load friends.</div>';
    }
}

// Display friends list
function displayFriends(friends) {
    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div class="no-friends-message">
                <h4>No friends yet!</h4>
                <p>Add friends by their email address below, or join a party to automatically become friends with other members.</p>
            </div>
        `;
        return;
    }
    
    friendsList.innerHTML = friends.map(friend => {
        const displayName = friend.username || friend.email || 'Unknown User';
        const initials = displayName.substring(0, 2).toUpperCase();
        return `
            <div class="friend-card">
                <div class="friend-info">
                    <div class="friend-avatar">
                        ${initials}
                    </div>
                    <div class="friend-details">
                        <h4>${displayName}</h4>
                        <p>${friend.username ? friend.email : 'Fellow Adventurer'}</p>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn-secondary" onclick="viewFriendAvailability('${friend.id}')">View Schedule</button>
                    <button class="btn-primary" onclick="inviteToParty('${friend.id}')">Invite to Party</button>
                </div>
            </div>
        `;
    }).join('');
}

// Load party members
async function loadPartyMembers() {
    if (!currentUser) return;
    
    try {
        const groupsResult = await getUserGroups(currentUser.uid);
        
        if (groupsResult.success && groupsResult.data.length > 0) {
            await displayPartyMembers(groupsResult.data);
        } else {
            partyMembersList.innerHTML = '<div class="no-parties-message">You are not in any parties yet. Join or create a party to see members here!</div>';
        }
    } catch (error) {
        console.error('Error loading party members:', error);
        partyMembersList.innerHTML = '<div class="no-parties-message">Failed to load party members.</div>';
    }
}

// Display party members
async function displayPartyMembers(groups) {
    const partiesHtml = [];
    
    for (const group of groups) {
        // Get user details for all members
        const membersResult = await getUsersByIds(group.members);
        const members = membersResult.success ? membersResult.data : [];
        
        const membersHtml = members.map(member => {
            const isHost = member.id === group.hostId;
            const isCurrentUser = member.id === currentUser.uid;
            const displayName = isCurrentUser ? 'You' : (member.username || member.email || 'Unknown User');
            const initials = isCurrentUser ? 'ME' : (member.username || member.email || 'UK').substring(0, 2).toUpperCase();
            
            return `
                <div class="party-member">
                    <div class="friend-avatar">
                        ${initials}
                    </div>
                    <div class="member-info">
                        <h5>
                            ${displayName}
                            ${isHost ? '<span class="host-badge">Host</span>' : ''}
                        </h5>
                        <p>${isCurrentUser ? currentUser.email : (member.username ? member.email : 'Party Member')}</p>
                    </div>
                </div>
            `;
        }).join('');
        
        partiesHtml.push(`
            <div class="party-group">
                <h4>${group.name} <span style="color: #c9b037; font-size: 0.9rem;">(${group.members.length} members)</span></h4>
                <div class="party-members">
                    ${membersHtml}
                </div>
            </div>
        `);
    }
    
    partyMembersList.innerHTML = partiesHtml.join('');
}

// Placeholder functions for future features
function viewFriendAvailability(friendId) {
    alert('Feature coming soon: View friend\'s availability schedule');
}

function inviteToParty(friendId) {
    alert('Feature coming soon: Invite friend to one of your parties');
}

// Make functions global for onclick handlers
window.viewFriendAvailability = viewFriendAvailability;
window.inviteToParty = inviteToParty;

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
            
            loadFriends();
            loadPartyMembers();
        } else {
            window.location.href = '../login/login.html';
        }
    });
    
    // Form submission
    addFriendForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('friend-email').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        addLoadingState(submitBtn);
        
        await handleAddFriend(email);
        
        removeLoadingState(submitBtn, originalText);
    });
    
    // Logout
    logoutBtn?.addEventListener('click', handleLogout);
});
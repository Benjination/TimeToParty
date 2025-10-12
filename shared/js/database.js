// Database utility functions for Firestore operations
import { 
    collection, 
    doc, 
    addDoc, 
    getDoc, 
    getDocs, 
    setDoc,
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy,
    serverTimestamp,
    arrayUnion,
    arrayRemove
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

// User operations
export async function createUserProfile(userId, userData) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            ...userData,
            createdAt: serverTimestamp(),
            friends: [],
            groups: []
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating user profile:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserProfile(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            return { success: true, data: userSnap.data() };
        } else {
            return { success: false, error: 'User not found' };
        }
    } catch (error) {
        console.error('Error getting user profile:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserByEmail(email) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            return { success: true, data: { id: userDoc.id, ...userDoc.data() } };
        } else {
            return { success: false, error: 'User not found' };
        }
    } catch (error) {
        console.error('Error getting user by email:', error);
        return { success: false, error: error.message };
    }
}

export async function getUsersByIds(userIds) {
    try {
        const users = [];
        for (const userId of userIds) {
            const userResult = await getUserProfile(userId);
            if (userResult.success) {
                users.push({ id: userId, ...userResult.data });
            }
        }
        return { success: true, data: users };
    } catch (error) {
        console.error('Error getting users by IDs:', error);
        return { success: false, error: error.message };
    }
}

// Group operations
export async function createGroup(hostUserId, groupData) {
    try {
        // Generate unique 6-digit group ID
        const groupId = Math.floor(100000 + Math.random() * 900000).toString();
        
        const groupRef = doc(db, 'groups', groupId);
        await setDoc(groupRef, {
            ...groupData,
            groupId: groupId,
            hostId: hostUserId,
            members: [hostUserId],
            createdAt: serverTimestamp(),
            isActive: true
        });
        
        // Add group to user's groups list
        const userRef = doc(db, 'users', hostUserId);
        await updateDoc(userRef, {
            groups: arrayUnion(groupId)
        });
        
        return { success: true, groupId: groupId };
    } catch (error) {
        console.error('Error creating group:', error);
        return { success: false, error: error.message };
    }
}

export async function joinGroup(userId, groupId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (!groupSnap.exists()) {
            return { success: false, error: 'Group not found' };
        }
        
        const groupData = groupSnap.data();
        
        // Check if user is already in group
        if (groupData.members.includes(userId)) {
            return { success: false, error: 'You are already in this group' };
        }
        
        // Add user to group
        await updateDoc(groupRef, {
            members: arrayUnion(userId)
        });
        
        // Add group to user's groups list
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            groups: arrayUnion(groupId)
        });
        
        // Add all existing group members as friends
        const friendPromises = groupData.members.map(async (memberId) => {
            if (memberId !== userId) {
                await addFriend(userId, memberId);
                await addFriend(memberId, userId);
            }
        });
        
        await Promise.all(friendPromises);
        
        return { success: true, groupData: { ...groupData, members: [...groupData.members, userId] } };
    } catch (error) {
        console.error('Error joining group:', error);
        return { success: false, error: error.message };
    }
}

export async function getGroup(groupId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
            return { success: true, data: groupSnap.data() };
        } else {
            return { success: false, error: 'Group not found' };
        }
    } catch (error) {
        console.error('Error getting group:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserGroups(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return { success: false, error: 'User not found' };
        }
        
        const userData = userSnap.data();
        const groupIds = userData.groups || [];
        
        if (groupIds.length === 0) {
            return { success: true, data: [] };
        }
        
        // Get all group details
        const groupPromises = groupIds.map(async (groupId) => {
            const result = await getGroup(groupId);
            return result.success ? result.data : null;
        });
        
        const groups = (await Promise.all(groupPromises)).filter(group => group !== null);
        
        return { success: true, data: groups };
    } catch (error) {
        console.error('Error getting user groups:', error);
        return { success: false, error: error.message };
    }
}

// Friend operations
export async function addFriend(userId, friendId) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            friends: arrayUnion(friendId)
        });
        return { success: true };
    } catch (error) {
        console.error('Error adding friend:', error);
        return { success: false, error: error.message };
    }
}

export async function removeFriend(userId, friendId) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            friends: arrayRemove(friendId)
        });
        return { success: true };
    } catch (error) {
        console.error('Error removing friend:', error);
        return { success: false, error: error.message };
    }
}

export async function getUserFriends(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        
        if (!userSnap.exists()) {
            return { success: false, error: 'User not found' };
        }
        
        const userData = userSnap.data();
        const friendIds = userData.friends || [];
        
        if (friendIds.length === 0) {
            return { success: true, data: [] };
        }
        
        // Get all friend details
        const friendPromises = friendIds.map(async (friendId) => {
            const result = await getUserProfile(friendId);
            return result.success ? { id: friendId, ...result.data } : null;
        });
        
        const friends = (await Promise.all(friendPromises)).filter(friend => friend !== null);
        
        return { success: true, data: friends };
    } catch (error) {
        console.error('Error getting user friends:', error);
        return { success: false, error: error.message };
    }
}

// Utility function to generate invite link
export function generateInviteLink(groupId) {
    const baseUrl = window.location.origin;
    return `${baseUrl}/pages/join-group/join-group.html?groupId=${groupId}`;
}
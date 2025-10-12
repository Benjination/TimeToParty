// Character Creation Page JavaScript
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { auth } from '../../shared/js/firebase-config.js';
import { showError, showSuccess, addLoadingState, removeLoadingState } from '../../shared/js/utils.js';

// DOM Elements
const characterForm = document.getElementById('character-form');
const characterClassSelect = document.getElementById('character-class');
const previewImage = document.getElementById('preview-image');
const characterDescription = document.getElementById('character-description');

// Character data
const characterClasses = {
    barbarian: {
        name: 'Barbarian',
        image: '../../Images/BarbarianFemale.png',
        description: 'A fierce warrior of primitive background who can enter a battle rage. Barbarians excel in combat through their primal instincts and incredible strength.'
    },
    bard: {
        name: 'Bard',
        image: '../../Images/Bard.png',
        description: 'A master of song, speech, and the magic they contain. Bards are versatile characters who can inspire allies and weave powerful enchantments.'
    },
    monk: {
        name: 'Monk',
        image: '../../Images/Monk.png',
        description: 'A master of martial arts, harnessing inner power through discipline and meditation. Monks combine physical prowess with spiritual enlightenment.'
    },
    sorceror: {
        name: 'Sorceror',
        image: '../../Images/Sorceror.png',
        description: 'A spellcaster who draws on inherent magic from a gift or bloodline. Sorcerors wield raw magical power with intuitive understanding.'
    },
    warlock: {
        name: 'Warlock',
        image: '../../Images/Warlock.png',
        description: 'A wielder of magic derived from a bargain with an extraplanar entity. Warlocks gain power through pacts with otherworldly beings.'
    },
    dwarf: {
        name: 'Dwarf',
        image: '../../Images/Dwarf.png',
        description: 'A stout-hearted folk known for their skill in warfare, crafting, and resistance to magic. Dwarves are stalwart defenders of their people.'
    }
};

// Character Creation Functions
function updateCharacterPreview() {
    const selectedClass = characterClassSelect.value;
    
    if (selectedClass && characterClasses[selectedClass]) {
        const classData = characterClasses[selectedClass];
        previewImage.src = classData.image;
        previewImage.alt = classData.name;
        characterDescription.innerHTML = `<p><strong>${classData.name}</strong></p><p>${classData.description}</p>`;
    } else {
        previewImage.src = '../../Images/DungeonMaster.png';
        previewImage.alt = 'Character Preview';
        characterDescription.innerHTML = '<p>Select a class to see your character</p>';
    }
}

async function handleCharacterCreation(characterData) {
    try {
        // Here you would typically save to Firestore
        // For now, we'll just show a success message and store locally
        console.log('Character created:', characterData);
        
        // Store character data locally (you can replace this with Firestore later)
        localStorage.setItem('userCharacter', JSON.stringify({
            ...characterData,
            userId: auth.currentUser?.uid,
            createdAt: new Date().toISOString()
        }));
        
        showSuccess('Character created successfully! Welcome to the adventure!', characterForm);
        
        // Navigate back to dashboard after a brief delay
        setTimeout(() => {
            window.location.href = '../dashboard/dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Character creation error:', error);
        showError('Failed to create character. Please try again.', characterForm);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            // Redirect to login if not authenticated
            window.location.href = '../login/login.html';
        }
    });
    
    // Character class selection
    characterClassSelect?.addEventListener('change', updateCharacterPreview);
    
    // Form submission
    characterForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const characterName = document.getElementById('character-name').value;
        const characterClass = document.getElementById('character-class').value;
        const characterBackstory = document.getElementById('character-backstory').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        // Validate required fields
        if (!characterName || !characterClass) {
            showError('Please fill in all required fields.', characterForm);
            return;
        }
        
        addLoadingState(submitBtn);
        
        const characterData = {
            name: characterName,
            class: characterClass,
            backstory: characterBackstory || '',
            classData: characterClasses[characterClass]
        };
        
        await handleCharacterCreation(characterData);
        
        removeLoadingState(submitBtn, originalText);
    });
});
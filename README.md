# Time to Party 🎲⚔️

A D&D party finder and group management web application built with Firebase and vanilla JavaScript.

## 🎯 Features

- **Firebase Authentication** - Secure email/password login and registration with usernames
- **Group Management** - Create and join D&D parties with unique 6-digit IDs
- **Party Chat** - Real-time messaging system for party communication
- **Friends System** - Add friends by email and manage your adventurer network
- **Availability Scheduler** - Interactive calendar for planning game sessions
- **Invite System** - Share party links with friends for easy joining
- **Auto-Friending** - Party members automatically become friends
- **Responsive Design** - Works on desktop and mobile devices
- **Fantasy Theme** - Immersive medieval/D&D aesthetic

## 🏗️ Project Structure

```
TimeToParty/
├── index.html                 # Main entry point (redirects to login)
├── Images/                    # Character artwork and assets
├── pages/                     # Individual page components
│   ├── login/                 # Login page
│   ├── signup/                # Registration page  
│   ├── dashboard/             # Main dashboard
│   ├── character-creation/    # Character builder
│   ├── groups/                # Party management
│   └── join-group/            # Invite link landing page
└── shared/                    # Common resources
    ├── css/base.css          # Shared styles
    └── js/                   # Utilities and Firebase config
        ├── firebase-config.js
        ├── database.js
        └── utils.js
```

## 🚀 Getting Started

### Prerequisites
- Firebase project with Authentication and Firestore enabled
- Web browser with JavaScript enabled

### Firebase Setup
1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication with Email/Password provider
3. Create a Firestore database
4. Copy your Firebase config to `shared/js/firebase-config.js`

### Local Development
1. Clone this repository
2. Update Firebase configuration in `shared/js/firebase-config.js`
3. Open `pages/login/login.html` in your browser
4. Or serve with a local web server for full functionality

### Deployment
This project is designed to work with GitHub Pages:
1. Push to your GitHub repository
2. Enable GitHub Pages in repository settings
3. Your site will be available at `username.github.io/TimeToParty`

## 🎮 How to Use

### Creating a Party
1. Log in to your account
2. Go to "Manage Parties" from the dashboard
3. Fill out the "Start a New Adventure" form
4. Share the generated party link with friends

### Joining a Party
- **Via Link**: Click an invite link shared by a friend
- **Via ID**: Enter the 6-digit party ID in "Join an Existing Party"

### Character Creation
1. Click "Create Character" from the dashboard
2. Choose your character class and enter details
3. Your character will be saved to your profile

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6 modules)
- **Backend**: Firebase Authentication & Firestore
- **Hosting**: GitHub Pages
- **Design**: Custom CSS with medieval/fantasy theme

## 📱 Features in Detail

### Authentication System
- Secure email/password registration and login
- Password reset functionality
- Session management with Firebase Auth

### Group Management
- Create parties with custom names and descriptions
- Unique 6-digit party IDs for easy sharing
- Maximum player limits (3-8 players)
- Host privileges and member management

### Social Features
- Automatic friend connections when joining parties
- Shareable invite links
- Party member visibility

### Character System
- Character creation with class selection
- Character artwork for each class
- Backstory and customization options

## 🎨 Design

The application features a fantasy/medieval theme with:
- Rich brown and gold color palette
- Character artwork from classic D&D classes
- Responsive grid layouts
- Smooth animations and hover effects
- Mobile-friendly design

## 🔒 Security

- Firebase Authentication handles all user security
- Firestore security rules protect user data
- Client-side validation with server-side verification
- No sensitive data stored in localStorage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🎲 About

Time to Party makes it easy for D&D players to find groups, organize parties, and connect with fellow adventurers. Whether you're a seasoned dungeon master or a new player looking for your first campaign, Time to Party helps bring adventurers together.

---

**Ready to start your adventure? [Join the party!](https://benjination.github.io/TimeToParty/)**
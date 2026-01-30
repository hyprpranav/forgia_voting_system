# Secure Hall-Restricted Voting System

A browser-based voting system for college expo events using ESP32, RFID, and Firebase.

## 🎯 System Overview

- **Audience receives voting code**: RFID scan at entrance → ESP32 generates 2-3 digit code
- **Time-limited access**: Codes expire in 30-60 minutes
- **Team voting**: Scan team QR → Enter code → Vote
- **Rate limiting**: 30 seconds between votes
- **One vote per team**: Each code can vote once per team
- **Live analytics**: Real-time dashboard for admins

## 📋 Prerequisites

1. **Hardware**:
   - ESP32 board
   - RC522 RFID module
   - College ID cards with RFID tags

2. **Software**:
   - Arduino IDE with ESP32 board support
   - Firebase account
   - Modern web browser

## 🔥 Firebase Setup (Step 1)

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `voting-system-expo`
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Firestore Database

1. In Firebase Console, go to **Build → Firestore Database**
2. Click "Create database"
3. Choose **Production mode**
4. Select a location closest to you
5. Click "Enable"

### 3. Configure Security Rules

1. Go to **Firestore Database → Rules**
2. Replace with the content from `firestore.rules`
3. Click "Publish"

### 4. Enable Authentication (Admin Only)

1. Go to **Build → Authentication**
2. Click "Get started"
3. Enable **Email/Password** provider
4. Click "Save"
5. Go to **Users** tab
6. Click "Add user"
7. Create admin credentials:
   - Email: `admin@yourcollegio.com`
   - Password: (Choose a strong password)

### 5. Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click **Web** icon (</>) to add web app
4. Register app name: `Voting System`
5. Copy the `firebaseConfig` object
6. Paste it into `js/firebase-config.js`

## 🔌 ESP32 Setup (Step 2)

### 1. Install Arduino IDE Libraries

Open Arduino IDE → Tools → Manage Libraries, search and install:
- `MFRC522` by GithubCommunity
- `Firebase ESP32 Client` by Mobizt
- `ArduinoJson` by Benoit Blanchon

### 2. Configure ESP32 Code

1. Open `esp32/voting_code_generator.ino` in Arduino IDE
2. Update WiFi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Update Firebase credentials (from Step 1):
   ```cpp
   #define FIREBASE_HOST "your-project-id.firebaseio.com"
   #define FIREBASE_AUTH "your-database-secret"
   ```

### 3. Wire RC522 to ESP32

| RC522 Pin | ESP32 Pin |
|-----------|-----------|
| SDA (SS)  | GPIO 5    |
| SCK       | GPIO 18   |
| MOSI      | GPIO 23   |
| MISO      | GPIO 19   |
| IRQ       | -         |
| GND       | GND       |
| RST       | GPIO 22   |
| 3.3V      | 3.3V      |

### 4. Upload Code

1. Select board: **Tools → Board → ESP32 Dev Module**
2. Select port: **Tools → Port → (Your ESP32 port)**
3. Click **Upload**
4. Open **Serial Monitor** (115200 baud)
5. Note the ESP32 IP address shown

## 🌐 Frontend Setup (Step 3)

### 1. Configure Firebase

1. Edit `js/firebase-config.js`
2. Paste your Firebase config from Firebase Console

### 2. Local Testing

Open `index.html` in a web browser or use a local server:

```bash
# Using Python 3
python -m http.server 8000

# Using Node.js (http-server)
npx http-server -p 8000
```

Then visit: `http://localhost:8000`

### 3. GitHub Pages Deployment (Production)

1. Create a new GitHub repository
2. Push all files (except `esp32/` folder)
3. Go to **Settings → Pages**
4. Source: **Deploy from a branch**
5. Branch: **main** → **/ (root)**
6. Click **Save**
7. Your site will be at: `https://yourusername.github.io/repo-name/`

## 🎮 Usage Guide

### Admin Dashboard

1. Open `index.html`
2. Login with admin credentials (created in Firebase Auth)
3. **Connect ESP32**:
   - Enter ESP32 IP address (e.g., `192.168.1.100`)
   - Click "Connect"
   - Green indicator = connected
4. **Monitor Code Generation**:
   - When RFID is scanned, code appears automatically
   - Manual generation button available as fallback
5. **Generate Team QR Codes**:
   - Enter Team Name and Team ID
   - Click "Generate QR"
   - Download PNG for printing
6. **View Analytics**:
   - Live vote counts per team
   - Rankings and statistics
   - Export results as CSV

### Voting Flow (Audience)

1. **At entrance**: Scan college ID on RFID reader
2. **Receive code**: Admin shows generated code on screen
3. **Scan team QR**: Each team displays their QR code
4. **Vote**: Enter code → Submit vote
5. **Rate limit**: Wait 30 seconds between votes
6. **Multiple teams**: Same code can vote for different teams

## 🔒 Security Features

- ✅ No personal data stored (RFID UID not saved)
- ✅ Time-limited codes (auto-expire)
- ✅ One vote per team per code
- ✅ Rate limiting (30s between votes)
- ✅ Server-side validation (Firebase rules)
- ✅ Admin authentication required
- ✅ No code reuse after expiration
- ✅ HTTPS on GitHub Pages

## 📁 Project Structure

```
voting-system/
├── index.html              # Admin Dashboard
├── vote.html               # Voting Page
├── css/
│   └── styles.css          # All styles
├── js/
│   ├── firebase-config.js  # Firebase configuration
│   ├── admin.js            # Admin dashboard logic
│   ├── voting.js           # Voting page logic
│   └── utils.js            # Shared utilities
├── esp32/
│   └── voting_code_generator.ino  # ESP32 Arduino code
├── firestore.rules         # Firebase security rules
└── README.md               # This file
```

## 🐛 Troubleshooting

### ESP32 Not Connecting
- Check WiFi credentials
- Verify ESP32 and computer on same network
- Check Serial Monitor for IP address
- Disable firewall temporarily

### RFID Not Reading
- Check wiring connections
- Verify 3.3V power (not 5V!)
- Test with Serial Monitor output

### Firebase Errors
- Verify firestore.rules are published
- Check Firebase config in firebase-config.js
- Ensure Firestore is enabled (not Realtime Database)

### Code Already Expired
- Adjust `CODE_VALIDITY_MINUTES` in ESP32 code
- Default is 30 minutes

### Vote Not Submitting
- Check browser console for errors
- Verify code hasn't expired
- Check 30-second rate limit
- Ensure you haven't already voted for this team

## 📊 Database Structure

### Firestore Collections

**votingCodes**
```json
{
  "code": "123",
  "createdAt": Timestamp,
  "expiresAt": Timestamp,
  "usedTeams": ["team1", "team2"],
  "lastVoteAt": Timestamp
}
```

**teams**
```json
{
  "teamId": "team1",
  "teamName": "Project Alpha",
  "votes": 15
}
```

**votes** (detailed tracking)
```json
{
  "teamId": "team1",
  "code": "123",
  "votedAt": Timestamp
}
```

## 🎓 Credits

Developed for college project expo voting system.

## 📄 License

MIT License - Free to use and modify for educational purposes.

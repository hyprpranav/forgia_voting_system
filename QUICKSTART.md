# Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Firebase Setup (2 minutes)
1. Go to https://console.firebase.google.com/
2. Create new project: "voting-system-expo"
3. Enable Firestore Database (Production mode)
4. Enable Authentication → Email/Password
5. Create admin user
6. Copy config to `js/firebase-config.js`
7. Deploy `firestore.rules`

### Step 2: ESP32 Setup (2 minutes)
1. Open `esp32/voting_code_generator.ino` in Arduino IDE
2. Update WiFi credentials
3. Update Firebase credentials
4. Wire RC522 to ESP32 (see wiring diagram in README)
5. Upload code
6. Note IP address from Serial Monitor

### Step 3: Test (1 minute)
1. Open `index.html` in browser
2. Login with admin credentials
3. Connect to ESP32 using IP address
4. Generate test QR code
5. Scan QR with phone → Enter test code → Vote!

---

## 📱 Day-of-Event Checklist

### Before Event Starts
- [ ] ESP32 powered on and connected to WiFi
- [ ] Admin dashboard open on display screen
- [ ] All team QR codes printed and distributed
- [ ] Admin logged in
- [ ] Test one complete vote flow
- [ ] RFID reader tested with college ID

### During Event
- [ ] Staff monitors admin dashboard
- [ ] Codes displayed prominently when generated
- [ ] Audience directed to scan team QR codes
- [ ] Analytics refreshed periodically

### After Event
- [ ] Export results as CSV
- [ ] Announce winners
- [ ] Archive data from Firebase

---

## 🎯 User Flows

### Admin Flow
```
1. Login → Dashboard
2. Connect ESP32 (enter IP)
3. Generate Team QR Codes
4. Monitor code generation when RFID scanned
5. View live analytics
6. Export results
```

### Voter Flow
```
1. Scan college ID at entrance
2. Receive voting code from display
3. Visit team booths
4. Scan team QR code with phone
5. Enter voting code
6. Submit vote
7. Wait 30 seconds
8. Repeat for other teams
```

---

## 🛠️ Troubleshooting Quick Fixes

### "ESP32 not connecting"
```bash
1. Check Serial Monitor for IP address
2. Verify computer and ESP32 on same network
3. Try http://192.168.1.100 in browser
4. Check firewall settings
```

### "RFID not reading"
```bash
1. Verify wiring (especially 3.3V, not 5V!)
2. Check Serial Monitor for card detection
3. Try different RFID card
4. Reseat all connections
```

### "Vote not submitting"
```bash
1. Check browser console for errors
2. Verify code hasn't expired
3. Confirm not already voted for team
4. Wait for 30-second rate limit
5. Check Firebase Firestore rules deployed
```

### "Firebase permission denied"
```bash
1. Verify firestore.rules published
2. Check admin authentication
3. Ensure Firestore (not Realtime DB) enabled
4. Review browser console errors
```

---

## 📊 Sample Team QR Codes

To test the system, generate these sample teams:

| Team Name | Team ID |
|-----------|---------|
| Project Alpha | team1 |
| Innovation Hub | team2 |
| Tech Wizards | team3 |
| Code Masters | team4 |
| Future Vision | team5 |

Generate QR codes from admin dashboard and test voting!

---

## 🎓 Training Staff

### Admin Station Staff (2 people)
**Role**: Monitor dashboard and assist with issues

**Training** (5 minutes):
1. Login process
2. ESP32 connection
3. Code generation (auto + manual)
4. QR code generation if needed
5. Analytics viewing

### Entrance Staff (1-2 people)
**Role**: Guide voters to scan RFID

**Training** (3 minutes):
1. Ask attendee to scan college ID on reader
2. Point to screen when code appears
3. Explain: "Use this code to vote for teams"
4. Direct to team areas

### Team Representatives
**Role**: Display team QR code

**Training** (2 minutes):
1. Receive printed QR code poster
2. Display prominently at booth
3. Instruct visitors: "Scan this QR to vote for us"
4. No need to handle codes themselves

---

## 💡 Tips for Success

### WiFi Considerations
- Use dedicated event WiFi (not public)
- Keep ESP32 close to router
- Test connection before event
- Have mobile hotspot backup

### Display Recommendations
- Large monitor/TV for code display
- Position where voters can see clearly
- Good lighting (not too bright/dark)
- Keep admin computer nearby

### Voter Experience
- Clear signage: "Scan team QR → Enter code → Vote"
- Station staff to help first-time voters
- Test with a few people before opening
- Have instructions printed as backup

### Analytics Usage
- Refresh every 15-30 minutes during event
- Don't announce live results (reduces drama!)
- Export final results after voting closes
- Verify totals before announcing winners

---

## 📞 Support Contacts

**Technical Issues**:
- Firebase Console: https://console.firebase.google.com/
- ESP32 Docs: https://docs.espressif.com/
- Arduino Forum: https://forum.arduino.cc/

**Project Files**:
- All code in workspace folder
- Backup config in README.md
- Security docs in SECURITY.md

---

## 🎉 Post-Event

### Data Export
1. Open admin dashboard
2. Click "Export CSV"
3. Save file: `voting_results_YYYY-MM-DD.csv`

### Cleanup
1. Logout from admin dashboard
2. Power off ESP32
3. Archive Firebase project (optional)
4. Share results with participants

### Feedback
Consider tracking:
- Total voters
- Average votes per team
- Peak voting times
- Technical issues encountered

Use this data to improve for next event!

---

**Ready to go? Follow the 5-minute setup above and you'll be live!** 🚀

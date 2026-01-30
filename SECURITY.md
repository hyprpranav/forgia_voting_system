# Security Considerations & Best Practices

## 🔒 Security Overview

This voting system implements multiple layers of security to ensure fair voting and protect user privacy.

## Privacy Protection

### 1. No Personal Data Storage
- ✅ **RFID UID is NOT stored** in database
- ✅ Only random voting codes are generated and saved
- ✅ No link between individual identity and votes
- ✅ Complies with data minimization principles

### 2. Anonymity
- Votes are linked only to codes, not people
- No tracking of who received which code
- No personal information collected on voting page

## Vote Integrity

### 1. Time-Limited Codes
```javascript
// Codes automatically expire after 30-60 minutes
expiresAt: currentTime + CODE_VALIDITY_MINUTES
```

**Purpose**: Prevents code sharing outside the event.

### 2. One Vote Per Team Per Code
```javascript
// Firestore enforces this rule
usedTeams: ["team1", "team2"]  // Array tracks voted teams
```

**Purpose**: Allows voting for multiple teams but prevents duplicate votes for same team.

### 3. Rate Limiting (30 seconds)
```javascript
// Prevents rapid-fire voting
lastVoteAt: timestamp
// Next vote allowed only after 30 seconds
```

**Purpose**: Prevents bot attacks and ensures deliberate voting.

### 4. Server-Side Validation
All validation happens in Firestore rules, not just client-side:
- Code expiry check
- Rate limit enforcement
- Duplicate vote prevention

## Firebase Security Rules

### Current Rules
Located in `firestore.rules`:

```javascript
// Code must be valid and not expired
function isValidCode(code) {
  let codeDoc = get(/databases/$(database)/documents/votingCodes/$(code));
  return codeDoc != null && codeDoc.data.expiresAt > request.time;
}

// Must wait 30 seconds between votes
function checkRateLimit(code) {
  let codeDoc = get(/databases/$(database)/documents/votingCodes/$(code));
  return !('lastVoteAt' in codeDoc.data) 
    || codeDoc.data.lastVoteAt < request.time - duration.value(30, 's');
}

// Cannot vote twice for same team
function hasVotedForTeam(code, teamId) {
  let codeDoc = get(/databases/$(database)/documents/votingCodes/$(code));
  return codeDoc.data.usedTeams.hasAny([teamId]);
}
```

### Admin Protection
- Only authenticated users can:
  - Create/delete voting codes
  - Create/delete teams
  - Read detailed vote logs
- Public can only:
  - Read code/team data for validation
  - Create votes (with validation)

## Network Security

### 1. HTTPS Required
When deployed to GitHub Pages:
- ✅ Automatic HTTPS encryption
- ✅ Firebase connections use TLS
- ✅ No sensitive data in transit

### 2. CORS Configuration
ESP32 allows cross-origin requests:
```cpp
server.sendHeader("Access-Control-Allow-Origin", "*");
```

**Note**: For production, restrict to specific domains:
```cpp
server.sendHeader("Access-Control-Allow-Origin", "https://yourdomain.com");
```

### 3. Local Network Isolation
ESP32 should be on event WiFi network:
- Not exposed to public internet
- Only accessible within venue
- Admin connects via local IP

## Attack Prevention

### 1. Code Guessing Prevention
**Attack**: Brute-force trying all codes (10-999)

**Mitigations**:
- Time-limited codes (reduce attack window)
- Rate limiting (slows down attempts)
- Server-side validation (can't bypass)
- Random 3-digit space (1000 possibilities)

**Enhancement** (if needed):
```javascript
// Add failed attempt tracking in Firestore
// Block IPs with >10 failed attempts in 1 minute
```

### 2. Replay Attacks
**Attack**: Reusing intercepted valid code

**Mitigations**:
- Code expires after time limit
- Can't vote twice for same team
- Rate limiting prevents rapid reuse

### 3. XSS (Cross-Site Scripting)
**Attack**: Injecting malicious scripts via team names

**Mitigation**:
```javascript
function sanitizeInput(input) {
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}
```

All user inputs are sanitized before display.

### 4. SQL Injection
**Not Applicable**: Using Firestore (NoSQL), not SQL database.

### 5. CSRF (Cross-Site Request Forgery)
**Mitigation**: Firebase SDK handles CSRF tokens automatically.

## ESP32 Security

### 1. WiFi Credentials
**⚠️ WARNING**: Never commit WiFi passwords to Git!

```cpp
// Store in separate file (not in repo)
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
```

**Best Practice**: Use `.gitignore` for credentials:
```
esp32/credentials.h
```

### 2. HTTP Server
Currently unprotected for local network simplicity.

**Production Hardening** (optional):
- Add basic auth for `/generateCode` endpoint
- Implement API key validation
- Use HTTPS (requires certificate)

### 3. Firmware Security
- Keep Arduino IDE and libraries updated
- Verify library sources before installing
- Test on isolated network first

## Admin Dashboard Security

### 1. Firebase Authentication
```javascript
auth.signInWithEmailAndPassword(email, password)
```

**Setup**:
1. Create strong admin password
2. Enable email verification
3. Don't share credentials

**Best Practices**:
- Change password regularly
- Use password manager
- Enable 2FA (if Firebase project supports)

### 2. Session Management
- Firebase handles session tokens
- Auto-logout on browser close (optional)
- Session expires after inactivity

### 3. Access Control
- Only authenticated users see admin functions
- Client-side + Firestore rules enforce this

## Data Privacy Compliance

### GDPR Considerations
✅ **Compliant** because:
- No personal data collected
- No identifiable information stored
- RFID UIDs not saved
- Users can't be tracked

### College Policy Compliance
- Verify with college IT department
- May need approval for WiFi device (ESP32)
- Ensure event attendees consent to voting

## Deployment Security

### GitHub Pages
✅ **Secure** when properly configured:
- HTTPS enabled by default
- No server-side code (static files)
- Firebase handles backend security

**Checklist**:
- [ ] Enable HTTPS (automatic)
- [ ] Don't commit Firebase API keys to public repo
- [ ] Use environment-specific configs
- [ ] Monitor Firebase usage for abuse

### Firebase Configuration
**⚠️ API Keys in Client Code**:
Firebase API keys in `firebase-config.js` are **safe to expose** because:
- They identify your project, not authenticate requests
- Security Rules protect your data
- Can restrict API key usage in Firebase Console

**Restrict API Key** (recommended):
1. Go to Google Cloud Console
2. APIs & Services → Credentials
3. Find your API key
4. Restrict to:
   - HTTP referrers (your domain)
   - Firebase services only

## Monitoring & Auditing

### 1. Firebase Console Monitoring
Monitor for suspicious activity:
- Unusual spike in votes
- Rapid code generation
- Failed authentication attempts

### 2. Analytics Tracking
```javascript
// Track vote patterns
{
  teamId: "team1",
  votedAt: timestamp,
  code: "123"  // For audit trail
}
```

### 3. Export Audit Logs
Use CSV export feature to analyze:
- Vote timestamps
- Code usage patterns
- Team popularity trends

## Incident Response

### If Code Leaks Online
1. **Immediate**: Codes expire automatically (30-60 min)
2. **Manual**: Delete leaked code from Firestore
3. **Prevention**: Remind staff not to photograph codes

### If Database Compromised
1. Check Firebase Console → Authentication → Sign-in attempts
2. Review Firestore Rules deployment history
3. Rotate admin credentials
4. Export data and restore from backup if needed

### If ESP32 Stolen
1. Device only generates codes, doesn't store data
2. Change WiFi credentials
3. Codes expire automatically
4. Minimal risk to system integrity

## Recommendations for Production

### Essential (Do Before Event)
- [ ] Test entire system end-to-end
- [ ] Create admin account with strong password
- [ ] Deploy Firestore rules
- [ ] Verify ESP32 connection on event WiFi
- [ ] Print team QR codes in advance
- [ ] Brief staff on code distribution process

### Recommended (Enhanced Security)
- [ ] Restrict Firebase API key to your domain
- [ ] Add IP-based rate limiting in Firebase
- [ ] Implement admin activity logging
- [ ] Use longer codes (4 digits) if needed
- [ ] Add CAPTCHA for voting (if bot concerns)

### Optional (Advanced)
- [ ] Two-factor authentication for admin
- [ ] Real-time anomaly detection
- [ ] Blockchain vote recording (overkill for most)
- [ ] Hardware security module for ESP32

## Testing Security

### Before Event
1. **Penetration Testing**:
   - Try voting with expired code
   - Attempt duplicate votes for same team
   - Test rate limiting by voting rapidly
   - Try invalid code formats

2. **Load Testing**:
   - Simulate 50+ concurrent voters
   - Monitor Firebase quota usage
   - Check ESP32 stability

3. **Privacy Audit**:
   - Verify no RFID UIDs in database
   - Confirm votes are anonymous
   - Check exported data contains no PII

## Support & Updates

### Keep Dependencies Updated
```bash
# Check for Arduino library updates monthly
# Firebase SDK updates quarterly
```

### Security Advisories
- Monitor Firebase security announcements
- Subscribe to ESP32 security bulletins
- Update libraries when vulnerabilities found

## Summary

This system balances **security**, **privacy**, and **usability**:

✅ **Strong Points**:
- No personal data storage
- Multiple validation layers
- Server-side enforcement
- Time-limited access
- Anonymous voting

⚠️ **Acceptable Trade-offs**:
- Simple codes (2-3 digits) for user convenience
- Local network ESP32 (not hardened server)
- Public Firebase API key (protected by rules)

🔒 **Overall Security**: **High** for a college event voting system.

---

For questions or security concerns, review Firebase documentation:
https://firebase.google.com/docs/rules/basics

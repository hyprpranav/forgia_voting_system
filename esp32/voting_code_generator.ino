/*
 * ESP32 Voting Code Generator with RFID
 * 
 * Features:
 * - Reads RFID UID from RC522
 * - Generates random 2-3 digit voting code
 * - Sends code to Firebase with expiry
 * - HTTP server for admin dashboard communication
 * - Does NOT store UID for privacy
 */

#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <MFRC522.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===== WiFi Configuration =====
const char* ssid = "Oppo A77s";
const char* password = "9080061674";

// ===== Firebase Configuration =====
// Get your Firebase REST API details from Firebase Console
const char* FIREBASE_HOST = "https://YOUR_PROJECT_ID.firebaseio.com";
const char* FIREBASE_PROJECT_ID = "YOUR_PROJECT_ID";
const char* FIREBASE_API_KEY = "YOUR_API_KEY";

// ===== RC522 Pin Configuration =====
#define SS_PIN 5      // SDA
#define RST_PIN 22    // RST
MFRC522 rfid(SS_PIN, RST_PIN);

// ===== Web Server =====
WebServer server(80);

// ===== Configuration =====
const int CODE_VALIDITY_MINUTES = 45;  // Code valid for 45 minutes
const int MIN_CODE = 10;                // Minimum 2-digit code
const int MAX_CODE = 999;               // Maximum 3-digit code

// ===== State Variables =====
String lastGeneratedCode = "";
String lastScannedUID = "";  // Store last scanned RFID UID
unsigned long lastRfidScanTime = 0;
const unsigned long RFID_SCAN_COOLDOWN = 2000; // 2 seconds between scans

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 Voting Code Generator ===");
  
  // Initialize SPI for RC522
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("✓ RC522 RFID Reader initialized");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup HTTP server routes
  setupServerRoutes();
  
  // Start server
  server.begin();
  Serial.println("✓ HTTP Server started");
  Serial.println("\n=== System Ready ===");
  Serial.println("Waiting for RFID scan...\n");
}

void loop() {
  // Handle HTTP requests
  server.handleClient();
  
  // Check for RFID card
  checkRFID();
}

// ===== WiFi Functions =====
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n✗ WiFi connection failed!");
  }
}

// ===== RFID Functions =====
void checkRFID() {
  // Cooldown to prevent multiple reads
  if (millis() - lastRfidScanTime < RFID_SCAN_COOLDOWN) {
    return;
  }
  
  // Check for new card
  if (!rfid.PICC_IsNewCardPresent()) {
    return;
  }
  
  // Verify if the card is readable
  if (!rfid.PICC_ReadCardSerial()) {
    return;
  }
  
  lastRfidScanTime = millis();
  
  // Get UID as string for comparison
  String currentUID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    currentUID += String(rfid.uid.uidByte[i], HEX);
  }
  
  // Check if this card was already scanned
  if (currentUID == lastScannedUID && lastScannedUID.length() > 0) {
    Serial.println("\n⚠️  WARNING: DUPLICATE CARD SCAN!");
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.println("⚠️  This card was already scanned!");
    Serial.println("⚠️  Please use a NEW card to generate code.");
    Serial.print("📱 Previous Code: ");
    Serial.println(lastGeneratedCode);
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    // Halt PICC
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;  // Don't generate new code
  }
  
  // New card detected - generate code
  Serial.println("\n🎫 NEW RFID Card Detected!");
  lastScannedUID = currentUID;  // Store this UID
  
  // Generate random voting code
  String votingCode = generateVotingCode();
  
  // Save to Firebase
  bool success = saveCodeToFirebase(votingCode);
  
  if (success) {
    lastGeneratedCode = votingCode;
    Serial.println("✓ Code saved to Firebase");
    Serial.print("📱 Voting Code: ");
    Serial.println(votingCode);
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━");
  } else {
    Serial.println("✗ Failed to save code to Firebase");
  }
  
  // Halt PICC
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

String generateVotingCode() {
  randomSeed(micros());
  int code = random(MIN_CODE, MAX_CODE + 1);
  return String(code);
}

// ===== Firebase Functions =====
bool saveCodeToFirebase(String code) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("✗ WiFi not connected");
    return false;
  }
  
  HTTPClient http;
  
  // Firestore REST API endpoint
  String url = String("https://firestore.googleapis.com/v1/projects/") + 
               FIREBASE_PROJECT_ID + 
               "/databases/(default)/documents/votingCodes/" + 
               code + 
               "?key=" + FIREBASE_API_KEY;
  
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Calculate expiry time (current time + CODE_VALIDITY_MINUTES)
  unsigned long currentTime = millis();
  unsigned long expiryTime = currentTime + (CODE_VALIDITY_MINUTES * 60 * 1000);
  
  // Create JSON payload for Firestore
  StaticJsonDocument<512> doc;
  doc["fields"]["code"]["stringValue"] = code;
  doc["fields"]["createdAt"]["timestampValue"] = getCurrentTimestamp();
  doc["fields"]["expiresAt"]["timestampValue"] = getExpiryTimestamp(CODE_VALIDITY_MINUTES);
  
  // Initialize empty array for usedTeams
  JsonArray usedTeamsArray = doc["fields"]["usedTeams"]["arrayValue"]["values"].to<JsonArray>();
  
  String payload;
  serializeJson(doc, payload);
  
  // Send PATCH request (create or update)
  int httpResponseCode = http.PATCH(payload);
  
  bool success = (httpResponseCode == 200 || httpResponseCode == 201);
  
  if (!success) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    Serial.println(http.getString());
  }
  
  http.end();
  return success;
}

String getCurrentTimestamp() {
  // In production, sync with NTP server
  // For now, use a relative timestamp
  return String(millis());
}

String getExpiryTimestamp(int validityMinutes) {
  // Calculate expiry timestamp
  unsigned long expiryMillis = millis() + (validityMinutes * 60 * 1000);
  return String(expiryMillis);
}

// ===== HTTP Server Routes =====
void setupServerRoutes() {
  // Root endpoint - status check
  server.on("/", HTTP_GET, handleRoot);
  
  // Get latest code
  server.on("/getLatestCode", HTTP_GET, handleGetLatestCode);
  
  // Manual code generation (fallback)
  server.on("/generateCode", HTTP_POST, handleManualGenerate);
  
  // Reset last scanned UID (allow new cards)
  server.on("/resetUID", HTTP_POST, handleResetUID);
  
  // Health check
  server.on("/health", HTTP_GET, handleHealth);
  
  // Handle CORS preflight
  server.on("/getLatestCode", HTTP_OPTIONS, handleCORS);
  server.on("/generateCode", HTTP_OPTIONS, handleCORS);
  server.on("/resetUID", HTTP_OPTIONS, handleCORS);
  
  // 404 handler
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>Forgia 2k26 - Voting System</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial;padding:20px;background:#f0f0f0;}";
  html += ".card{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin:10px 0;}";
  html += "h1{color:#333;}.code{font-size:48px;font-weight:bold;color:#4CAF50;text-align:center;margin:20px 0;}";
  html += ".status{color:#666;}.green{color:#4CAF50;}.red{color:#f44336;}";
  html += ".event-info{background:linear-gradient(135deg,#FF6B35,#F7931E);color:white;padding:15px;border-radius:8px;text-align:center;margin-bottom:15px;}</style></head><body>";
  html += "<div class='event-info'><h2 style='margin:0;'>🎫 Forgia 2k26</h2><p style='margin:5px 0;'>Project Expo | 31st Jan 2026 | 3:00 PM - 5:00 PM</p></div>";
  html += "<h1>ESP32 Voting System</h1>";
  html += "<div class='card'><h2>System Status</h2>";
  html += "<p class='status'>WiFi: <span class='green'>Connected</span></p>";
  html += "<p class='status'>IP: " + WiFi.localIP().toString() + "</p>";
  html += "<p class='status'>RFID: <span class='green'>Ready</span></p></div>";
  html += "<div class='card'><h2>Latest Code</h2>";
  
  if (lastGeneratedCode.length() > 0) {
    html += "<div class='code'>" + lastGeneratedCode + "</div>";
  } else {
    html += "<p style='text-align:center;color:#999;'>No code generated yet</p>";
  }
  
  html += "</div><div class='card'><h2>Instructions</h2>";
  html += "<ol><li>Scan RFID card at entrance</li>";
  html += "<li>Code will be displayed here and on admin dashboard</li>";
  html += "<li>Audience uses code to vote for teams</li></ol></div>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleGetLatestCode() {
  // Enable CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  StaticJsonDocument<200> doc;
  doc["code"] = lastGeneratedCode;
  doc["timestamp"] = millis();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleManualGenerate() {
  // Enable CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  String votingCode = generateVotingCode();
  bool success = saveCodeToFirebase(votingCode);
  
  StaticJsonDocument<200> doc;
  
  if (success) {
    lastGeneratedCode = votingCode;
    doc["success"] = true;
    doc["code"] = votingCode;
    doc["message"] = "Code generated successfully";
  } else {
    doc["success"] = false;
    doc["message"] = "Failed to save code to Firebase";
  }
  
  String response;
  serializeJson(doc, response);
  
  server.send(success ? 200 : 500, "application/json", response);
}

void handleResetUID() {
  // Enable CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  lastScannedUID = "";  // Clear last scanned UID
  Serial.println("\n🔄 UID Reset - Ready for new cards");
  
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["message"] = "UID reset successfully. Ready for new cards.";
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleHealth() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  StaticJsonDocument<200> doc;
  doc["status"] = "online";
  doc["wifi"] = (WiFi.status() == WL_CONNECTED);
  doc["ip"] = WiFi.localIP().toString();
  doc["uptime"] = millis();
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.send(204);
}

void handleNotFound() {
  server.send(404, "text/plain", "404: Not Found");
}

/*
 * ESP32 RFID Card Reader for Voting System
 * 
 * Features:
 * - Reads RFID UID from RC522
 * - Sends UID to frontend dashboard
 * - Frontend generates and saves codes to Firebase
 * - Duplicate card detection
 * - HTTP server for frontend communication
 */

#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>

// ===== WiFi Configuration =====
const char* ssid = "Oppo A77s";
const char* password = "9080061674";

// ===== RC522 Pin Configuration =====
#define SS_PIN 5      // SDA
#define RST_PIN 22    // RST
MFRC522 rfid(SS_PIN, RST_PIN);

// ===== Web Server =====
WebServer server(80);

// ===== State Variables =====
String latestCardUID = "";  // Latest scanned card UID
String lastScannedUID = "";  // Previous scanned UID for duplicate detection
unsigned long lastCardTimestamp = 0;
unsigned long lastRfidScanTime = 0;
const unsigned long RFID_SCAN_COOLDOWN = 2000; // 2 seconds between scans
bool newCardAvailable = false;

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
  
  // Get UID as string
  String currentUID = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) currentUID += "0";
    currentUID += String(rfid.uid.uidByte[i], HEX);
  }
  currentUID.toUpperCase();
  
  // Check if this card was already scanned
  if (currentUID == lastScannedUID && lastScannedUID.length() > 0) {
    Serial.println("\n⚠️  WARNING: DUPLICATE CARD SCAN!");
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.println("⚠️  This card was already scanned!");
    Serial.println("⚠️  Please use a NEW card.");
    Serial.print("Card UID: ");
    Serial.println(currentUID);
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    
    // Halt PICC
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;  // Don't process duplicate
  }
  
  // New card detected
  Serial.println("\n🎫 NEW RFID Card Detected!");
  Serial.print("Card UID: ");
  Serial.println(currentUID);
  
  // Store for duplicate detection
  lastScannedUID = currentUID;
  latestCardUID = currentUID;
  lastCardTimestamp = millis();
  newCardAvailable = true;
  
  Serial.println("✓ Card UID ready for frontend");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  
  // Halt PICC
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ===== HTTP Server Routes =====
void setupServerRoutes() {
  // Root endpoint - status check
  server.on("/", HTTP_GET, handleRoot);
  
  // Get latest card UID (for frontend to generate code)
  server.on("/getLatestCard", HTTP_GET, handleGetLatestCard);
  
  // Acknowledge card processed (clear flag)
  server.on("/acknowledgeCard", HTTP_POST, handleAcknowledgeCard);
  
  // Reset last scanned UID (allow rescans)
  server.on("/resetUID", HTTP_POST, handleResetUID);
  
  // Health check
  server.on("/health", HTTP_GET, handleHealth);
  
  // Handle CORS preflight
  server.on("/getLatestCard", HTTP_OPTIONS, handleCORS);
  server.on("/acknowledgeCard", HTTP_OPTIONS, handleCORS);
  server.on("/resetUID", HTTP_OPTIONS, handleCORS);
  
  // 404 handler
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>Forgia 2k26 - Voting System</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial;padding:20px;background:#f0f0f0;}";
  html += ".card{background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);margin:10px 0;}";
  html += "h1{color:#333;}.code{font-size:36px;font-weight:bold;color:#4CAF50;text-align:center;margin:20px 0;font-family:monospace;}";
  html += ".status{color:#666;}.green{color:#4CAF50;}.red{color:#f44336;}";
  html += ".event-info{background:linear-gradient(135deg,#FF6B35,#F7931E);color:white;padding:15px;border-radius:8px;text-align:center;margin-bottom:15px;}</style></head><body>";
  html += "<div class='event-info'><h2 style='margin:0;'>🎫 Forgia 2k26</h2><p style='margin:5px 0;'>Project Expo | 31st Jan 2026 | 3:00 PM - 5:00 PM</p></div>";
  html += "<h1>ESP32 RFID Reader</h1>";
  html += "<div class='card'><h2>System Status</h2>";
  html += "<p class='status'>WiFi: <span class='green'>Connected</span></p>";
  html += "<p class='status'>IP: " + WiFi.localIP().toString() + "</p>";
  html += "<p class='status'>RFID: <span class='green'>Ready</span></p></div>";
  html += "<div class='card'><h2>Latest Card Scanned</h2>";
  
  if (latestCardUID.length() > 0) {
    html += "<div class='code'>" + latestCardUID + "</div>";
    html += "<p style='text-align:center;color:#666;'>Card UID sent to frontend for code generation</p>";
  } else {
    html += "<p style='text-align:center;color:#999;'>No card scanned yet</p>";
  }
  
  html += "</div><div class='card'><h2>How It Works</h2>";
  html += "<ol><li>Scan RFID card at entrance</li>";
  html += "<li>Card UID sent to frontend dashboard</li>";
  html += "<li>Frontend generates voting code</li>";
  html += "<li>Code saved to Firebase automatically</li></ol></div>";
  html += "</body></html>";
  
  server.send(200, "text/html", html);
}

void handleGetLatestCard() {
  // Enable CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  
  StaticJsonDocument<200> doc;
  doc["cardUID"] = latestCardUID;
  doc["timestamp"] = lastCardTimestamp;
  doc["newCard"] = newCardAvailable;
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleAcknowledgeCard() {
  // Enable CORS
  server.sendHeader("Access-Control-Allow-Origin", "*");
  
  newCardAvailable = false;  // Clear flag after frontend processes
  Serial.println("✓ Card acknowledged by frontend");
  
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["message"] = "Card acknowledged";
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
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

#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <vector>

#define GPS_RX_PIN 16          // GPS RX pin
#define GPS_TX_PIN 17          // GPS TX pin
#define SCREEN_WIDTH 128       // OLED display width, in pixels
#define SCREEN_HEIGHT 64       // OLED display height, in pixels
#define BUTTON_PIN 2           // GPIO2 button pin
#define MIN_VALID_SPEED 0.5    // Minimum speed in km/h to consider the tractor moving

// WiFi credentials
const char* ssid = "Your_WiFi_SSID";
const char* password = "Your_WiFi_Password";
const char* serverURL = "https://your-deployed-app.vercel.app/api/sensor-data";

// Field information
String fieldName = "Field 1";

// Create hardware serial object for GPS
HardwareSerial gpsSerial(1);
TinyGPSPlus gps;

// Initialize OLED display
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// Store GPS coordinates
std::vector<std::pair<double, double>> coordinates;

// Tractor status variables
double currentSpeed = 0;
double currentHeading = 0;
String tractorStatus = "idle";
unsigned long lastValidCoordinateTime = 0;
unsigned long lastDataSendTime = 0;
const unsigned long DATA_SEND_INTERVAL = 1500; // Send data every 1.5 seconds

// Filter variables
bool isFirstValidCoordinate = true;
double lastLat = 0;
double lastLon = 0;
const double MIN_DISTANCE_CHANGE = 0.00001; // Minimum change in coordinates to store

void setup() {
    Serial.begin(115200); // Debugging
    gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    
    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { // Address 0x3C for SSD1306
        Serial.println("SSD1306 allocation failed");
        for (;;);
    }
    
    // Initialize display
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(WHITE);
    display.setCursor(0, 0);
    display.println("GPS Area Calculator");
    display.println("Connecting to WiFi...");
    display.display();
    
    // Connect to WiFi
    WiFi.begin(ssid, password);
    int wifiAttempts = 0;
    while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
        delay(500);
        Serial.print(".");
        wifiAttempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Connected to WiFi!");
        display.println("WiFi Connected!");
    } else {
        Serial.println("WiFi connection failed!");
        display.println("WiFi Failed!");
    }
    display.println("Waiting for GPS...");
    display.display();
    
    delay(2000);
}

void loop() {
    // Process GPS data
    while (gpsSerial.available() > 0) {
        if (gps.encode(gpsSerial.read())) {
            processGPSData();
        }
    }

    // Check if button is pressed to calculate area
    if (digitalRead(BUTTON_PIN) == LOW) {
        double area = calculateArea();
        displayArea(area);
        sendAreaData(area);
        delay(500); // Debounce delay
    }
    
    // Send live data at regular intervals
    unsigned long currentTime = millis();
    if (currentTime - lastDataSendTime >= DATA_SEND_INTERVAL) {
        if (gps.location.isValid()) {
            sendLiveCoordinates();
        }
        lastDataSendTime = currentTime;
    }
}

void processGPSData() {
    if (gps.location.isValid()) {
        double lat = gps.location.lat();
        double lon = gps.location.lng();
        currentSpeed = gps.speed.kmph();
        
        if (gps.course.isValid()) {
            currentHeading = gps.course.deg();
        }
        
        // Update tractor status based on speed
        if (currentSpeed >= MIN_VALID_SPEED) {
            tractorStatus = "moving";
        } else {
            tractorStatus = "idle";
        }
        
        // Filter out invalid or duplicate coordinates
        if (isValidCoordinate(lat, lon)) {
            storeGPSCoordinates(lat, lon);
            lastValidCoordinateTime = millis();
        }
        
        // Display current GPS information
        displayGPSInfo(lat, lon);
    } else {
        display.clearDisplay();
        display.setCursor(0, 0);
        display.println("GPS Area Calculator");
        display.println("Searching for GPS...");
        display.display();
    }
}

bool isValidCoordinate(double lat, double lon) {
    // Filter out (0,0) coordinates or coordinates very close to 0,0
    if (fabs(lat) < 0.0001 && fabs(lon) < 0.0001) {
        return false;
    }
    
    // If this is the first valid coordinate, accept it
    if (isFirstValidCoordinate) {
        isFirstValidCoordinate = false;
        lastLat = lat;
        lastLon = lon;
        return true;
    }
    
    // Check if the coordinate has changed enough from the last one
    double distance = calculateDistance(lastLat, lastLon, lat, lon);
    if (distance < MIN_DISTANCE_CHANGE) {
        return false;
    }
    
    // Update last valid coordinates
    lastLat = lat;
    lastLon = lon;
    return true;
}

void storeGPSCoordinates(double lat, double lon) {
    coordinates.push_back({lat, lon});
    Serial.print("Stored coordinate: ");
    Serial.print(lat, 6);
    Serial.print(", ");
    Serial.println(lon, 6);
}

void displayGPSInfo(double lat, double lon) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("GPS Area Calculator");
    
    display.print("Lat: ");
    display.println(lat, 6);
    display.print("Lon: ");
    display.println(lon, 6);
    
    display.print("Speed: ");
    display.print(currentSpeed, 1);
    display.println(" km/h");
    
    display.print("Heading: ");
    display.print(currentHeading, 0);
    display.println(" deg");
    
    display.print("Points: ");
    display.println(coordinates.size());
    
    display.print("Status: ");
    display.println(tractorStatus);
    
    display.display();
}

void displayArea(double area) {
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("Area Calculation");
    
    display.print("Area: ");
    display.print(area, 4);
    display.println(" hectares");
    
    display.print("Points: ");
    display.println(coordinates.size());
    
    display.println("Press button to");
    display.println("return to GPS view");
    
    display.display();
}

double calculateArea() {
    if (coordinates.size() < 3) return 0.0; // Need at least 3 points
    
    double area = 0.0;
    int n = coordinates.size();
    
    for (int i = 0; i < n; i++) {
        double x1 = coordinates[i].first;
        double y1 = coordinates[i].second;
        double x2 = coordinates[(i + 1) % n].first;
        double y2 = coordinates[(i + 1) % n].second;
        area += (x1 * y2 - x2 * y1);
    }
    
    area = fabs(area) / 2.0;
    
    // Convert to square kilometers (approximate conversion)
    double areaInSquareKm = area * 111.32 * 111.32;
    
    // Convert to hectares (1 sq km = 100 hectares)
    double areaInHectares = areaInSquareKm * 100;
    
    return areaInHectares;
}

void sendLiveCoordinates() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected!");
        return;
    }
    
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON document
    DynamicJsonDocument doc(1024);
    doc["lat"] = gps.location.lat();
    doc["lon"] = gps.location.lng();
    doc["speed"] = currentSpeed;
    doc["heading"] = currentHeading;
    doc["status"] = tractorStatus;
    
    String jsonData;
    serializeJson(doc, jsonData);
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("Live data sent successfully");
    } else {
        Serial.print("Error sending live data. Error code: ");
        Serial.println(httpResponseCode);
    }
    
    http.end();
}

void sendAreaData(double area) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected!");
        return;
    }
    
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON document
    DynamicJsonDocument doc(16384); // Larger size to accommodate coordinates
    doc["area"] = area;
    doc["fieldName"] = fieldName;
    
    // Add coordinates array
    JsonArray coordArray = doc.createNestedArray("coordinates");
    for (size_t i = 0; i < coordinates.size(); i++) {
        JsonObject coord = coordArray.createNestedObject();
        coord["lat"] = coordinates[i].first;
        coord["lon"] = coordinates[i].second;
    }
    
    String jsonData;
    serializeJson(doc, jsonData);
    
    int httpResponseCode = http.POST(jsonData);
    
    if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println("Area data sent successfully");
    } else {
        Serial.print("Error sending area data. Error code: ");
        Serial.println(httpResponseCode);
    }
    
    http.end();
}

// Calculate distance between two coordinates in degrees
// This is a simple approximation for small distances
double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    return sqrt(pow(lat2 - lat1, 2) + pow(lon2 - lon1, 2));
}

#include <SoftwareSerial.h>

SoftwareSerial BT(0, 1); // TX, RX respectively
String readvoice;

// Define pin numbers for motors and ultrasonic sensor
const int motor1Pin1 = 3;   // PWM pin
const int motor1Pin2 = 5;   // PWM pin
const int motor2Pin1 = 6;   // PWM pin
const int motor2Pin2 = 9;   // PWM pin
const int trigPin = 7;      // Ultrasonic sensor trigger pin
const int echoPin = 8;      // Ultrasonic sensor echo pin

// PWM speed value
const int motorSpeed = 190;

// Variable to track if the robot is active
bool isActive = false;

void setup() {
  BT.begin(9600);
  Serial.begin(9600);
  pinMode(motor1Pin1, OUTPUT);
  pinMode(motor1Pin2, OUTPUT);
  pinMode(motor2Pin1, OUTPUT);
  pinMode(motor2Pin2, OUTPUT);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
}

// Function to measure distance using the ultrasonic sensor
long getDistance() {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH);
  return (duration * 0.0343) / 2; // Distance in cm
}

void loop() {
  while (BT.available()) {  // Check if there is an available byte to read
    delay(10); // Delay added to make things stable
    char c = BT.read(); // Conduct a serial read
    readvoice += c; // Build the string - "forward", "reverse", "left" and "right"
  }

  // Process voice commands if received
  if (readvoice.length() > 0) {
    Serial.println(readvoice);

    if (readvoice == "*forward#") {
      isActive = true; // Set active flag
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, motorSpeed);
      analogWrite(motor2Pin2, 0);
      delay(100);
    } else if (readvoice == "*back#") {
      isActive = true; // Set active flag
      analogWrite(motor1Pin1, 0);
      analogWrite(motor1Pin2, motorSpeed);
      analogWrite(motor2Pin1, 0);
      analogWrite(motor2Pin2, motorSpeed);
      delay(100);
    } else if (readvoice == "*left#") {
      isActive = true; // Set active flag
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, 0);
      analogWrite(motor2Pin2, 0);
      delay(8000);
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, motorSpeed);
      analogWrite(motor2Pin2, 0);
      delay(100);
    } else if (readvoice == "*right#") {
      isActive = true; // Set active flag
      analogWrite(motor1Pin1, 0);
      analogWrite(motor1Pin2, motorSpeed);
      analogWrite(motor2Pin1, motorSpeed);
      analogWrite(motor2Pin2, 0);
      delay(8000);
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, motorSpeed);
      analogWrite(motor2Pin2, 0);
      delay(100);
    } else if (readvoice == "*stop#") {
      isActive = false; // Clear active flag
      analogWrite(motor1Pin1, 0);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, 0);
      analogWrite(motor2Pin2, 0);
      delay(100);
    } 

    readvoice = ""; // Reset the variable
  }

  // If robot is active, check for obstacles
  if (isActive) {
    long distance = getDistance();
    Serial.println("Distance: " + String(distance) + " cm");

    if (distance < 20) {  // If an obstacle is detected within 20 cm
      Serial.println("Obstacle detected, turning left!");
      // Perform the left turn
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, 0);
      analogWrite(motor2Pin2, 0);
      delay(8000);
      // Move forward after turning
      analogWrite(motor1Pin1, motorSpeed);
      analogWrite(motor1Pin2, 0);
      analogWrite(motor2Pin1, motorSpeed);
      analogWrite(motor2Pin2, 0);
      delay(100);
    }
  }
}

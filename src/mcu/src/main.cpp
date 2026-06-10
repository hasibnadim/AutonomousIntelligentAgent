#include <Arduino.h>
#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ─── CONFIG ───────────────────────────────────────────────────────────────────
#define WIFI_SSID      "h00"
#define WIFI_PASSWORD  "1234nnoo"
#define TCP_HOST       "192.168.137.1"
#define TCP_PORT       9000

#define MOTOR_ENA  33
#define MOTOR_IN1  14
#define MOTOR_IN2  12
#define MOTOR_ENB  25
#define MOTOR_IN3  26
#define MOTOR_IN4  27

#define TRIG_L_PIN  18
#define ECHO_L_PIN  19
#define TRIG_R_PIN  4
#define ECHO_R_PIN  5

#define TEMP_PIN   21
#define FLAME_PIN  34
#define LED_PIN    2

#define WHEELBASE_CM   20.0f
#define WHEEL_RADIUS   3.5f
#define MAX_PWM        255
#define POS_HISTORY    100

// ─── MOTOR PWM CHANNELS ───────────────────────────────────────────────────────
#define CH_ENA 0
#define CH_ENB 1

// ─── GLOBALS ──────────────────────────────────────────────────────────────────
OneWire ow(TEMP_PIN);
DallasTemperature tempSensor(&ow);
WiFiClient tcpClient;

// Nav states
enum NavState { NAV_FORWARD, NAV_REVERSE, NAV_TURN_LEFT, NAV_TURN_RIGHT, NAV_ROTATE, NAV_HOMING, NAV_STOP };
enum DriveMode { MODE_AUTO, MODE_MANUAL };

NavState navState = NAV_FORWARD;
DriveMode driveMode = MODE_AUTO;
bool running = true;
bool emergency = false;

// Ultrasonic state machine
struct UltraSonic {
  uint8_t trigPin, echoPin;
  uint8_t state;
  unsigned long trigTime;
  float distance;
  float lastGood;
  int timeouts;

  UltraSonic(uint8_t trig, uint8_t echo)
    : trigPin(trig), echoPin(echo), state(0),
      trigTime(0), distance(400.0f), lastGood(400.0f), timeouts(0) {}
};
UltraSonic usL = {TRIG_L_PIN, ECHO_L_PIN};
UltraSonic usR = {TRIG_R_PIN, ECHO_R_PIN};
bool measureLeft = true;
unsigned long lastUsMeasure = 0;
#define US_COOLDOWN_MS 60

// Position tracking
struct PosEntry { float x, y, h; unsigned long ts; };
PosEntry posHistory[POS_HISTORY];
int posHead = 0;
float posX = 0, posY = 0, posH = 0;
int leftPWM = 0, rightPWM = 0;
unsigned long lastOdoTime = 0;

// State machine timers
unsigned long stateStartMs = 0;
unsigned long navActionDone = 0;
bool navWaiting = false;

// Homing
int rssiHome = 0;
bool rssiHomeSet = false;
unsigned long rssiDropStart = 0;
bool homingTriggered = false;

// Telemetry
unsigned long lastTelemetry = 0;
unsigned long lastReconnect = 0;

// Sensors
float temperature = 0;
bool flameDetected = false;
unsigned long lastSensorRead = 0;

// Manual drive state
int manualL = 0, manualR = 0;

// ─── MOTOR CONTROL ────────────────────────────────────────────────────────────
void motorsInit() {
  ledcSetup(CH_ENA, 1000, 8);
  ledcSetup(CH_ENB, 1000, 8);
  ledcAttachPin(MOTOR_ENA, CH_ENA);
  ledcAttachPin(MOTOR_ENB, CH_ENB);
  pinMode(MOTOR_IN1, OUTPUT); pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT); pinMode(MOTOR_IN4, OUTPUT);
}

void setMotor(bool leftSide, int pwm) {
  // pwm: -255 to 255
  bool fwd = pwm >= 0;
  int spd = abs(pwm);
  if (leftSide) {
    digitalWrite(MOTOR_IN1, fwd ? HIGH : LOW);
    digitalWrite(MOTOR_IN2, fwd ? LOW : HIGH);
    ledcWrite(CH_ENA, spd);
  } else {
    digitalWrite(MOTOR_IN3, fwd ? HIGH : LOW);
    digitalWrite(MOTOR_IN4, fwd ? LOW : HIGH);
    ledcWrite(CH_ENB, spd);
  }
  if (leftSide) leftPWM = pwm; else rightPWM = pwm;
}

void driveForward(int spd)  { setMotor(true, spd);  setMotor(false, spd); }
void driveBackward(int spd) { setMotor(true, -spd); setMotor(false, -spd); }
void pivotLeft(int spd)     { setMotor(true, -spd); setMotor(false, spd); }
void pivotRight(int spd)    { setMotor(true, spd);  setMotor(false, -spd); }
void motorsStop()           { setMotor(true, 0);    setMotor(false, 0); }

int dynamicSpeed(float distL, float distR) {
  float d = min(distL, distR);
  if (d < 30)  return 25;
  if (d < 50)  return 50;
  if (d < 100) return 152;
  return 255;
}

// ─── ULTRASONIC NON-BLOCKING ──────────────────────────────────────────────────
void updateUltrasonic(UltraSonic &us) {
  switch (us.state) {
    case 0: // IDLE
      digitalWrite(us.trigPin, LOW);
      delayMicroseconds(2);
      digitalWrite(us.trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(us.trigPin, LOW);
      us.trigTime = micros();
      us.state = 1;
      break;
    case 1: // TRIGGERED
      if (digitalRead(us.echoPin) == HIGH) {
        us.trigTime = micros();
        us.state = 2;
      } else if (micros() - us.trigTime > 30000) {
        us.timeouts++;
        if (us.timeouts >= 5) us.distance = us.lastGood;
        us.state = 0;
      }
      break;
    case 2: // WAITING
      if (digitalRead(us.echoPin) == LOW) {
        float d = (micros() - us.trigTime) * 0.0343f / 2.0f;
        if (d > 2 && d < 400) { us.distance = d; us.lastGood = d; us.timeouts = 0; }
        us.state = 0;
      } else if (micros() - us.trigTime > 30000) {
        us.timeouts++;
        if (us.timeouts >= 5) us.distance = us.lastGood;
        us.state = 0;
      }
      break;
  }
}

void tickUltrasonic() {
  unsigned long now = millis();
  UltraSonic &active = measureLeft ? usL : usR;
  updateUltrasonic(active);
  if (active.state == 0 && now - lastUsMeasure > US_COOLDOWN_MS) {
    measureLeft = !measureLeft;
    lastUsMeasure = now;
  }
}

// ─── ODOMETRY ─────────────────────────────────────────────────────────────────
void updateOdometry() {
  unsigned long now = millis();
  float dt = (now - lastOdoTime) / 1000.0f;
  lastOdoTime = now;
  if (dt <= 0 || dt > 0.5f) return;

  // cm/s estimate: PWM/255 * ~20cm/s max
  float vL = (leftPWM / 255.0f) * 20.0f;
  float vR = (rightPWM / 255.0f) * 20.0f;
  float v = (vL + vR) / 2.0f;
  float omega = (vR - vL) / WHEELBASE_CM;

  posH += omega * dt;
  posX += v * cos(posH) * dt;
  posY += v * sin(posH) * dt;

  posHistory[posHead] = {posX, posY, posH, now};
  posHead = (posHead + 1) % POS_HISTORY;
}

// ─── NAVIGATION STATE MACHINE ─────────────────────────────────────────────────
void setNavState(NavState s) {
  navState = s;
  stateStartMs = millis();
  navWaiting = false;
}

void tickNavigation() {
  if (!running || emergency || driveMode == MODE_MANUAL) {
    motorsStop();
    return;
  }

  float dL = usL.distance;
  float dR = usR.distance;
  unsigned long now = millis();
  int spd = dynamicSpeed(dL, dR);

  switch (navState) {
    case NAV_FORWARD:
      if (dL <= 15 || dR <= 15) { driveBackward(150); setNavState(NAV_REVERSE); break; }
      if (dL <= 30 && dR <= 30) { setNavState(NAV_ROTATE); break; }
      if (dL <= 50 && dR <= 50) { setNavState(NAV_ROTATE); break; }
      if (dL <= 30)             { setNavState(NAV_TURN_RIGHT); break; }
      if (dR <= 30)             { setNavState(NAV_TURN_LEFT);  break; }
      if (dL <= 50)             { setNavState(NAV_TURN_RIGHT); break; }
      if (dR <= 50)             { setNavState(NAV_TURN_LEFT);  break; }
      driveForward(spd);
      break;

    case NAV_REVERSE:
      if (now - stateStartMs < 300) { driveBackward(150); break; }
      if (dL > dR) setNavState(NAV_TURN_LEFT);
      else         setNavState(NAV_TURN_RIGHT);
      break;

    case NAV_TURN_LEFT:
      pivotLeft(150);
      if (now - stateStartMs > 500 && dL > 50 && dR > 50) setNavState(NAV_FORWARD);
      break;

    case NAV_TURN_RIGHT:
      pivotRight(150);
      if (now - stateStartMs > 500 && dL > 50 && dR > 50) setNavState(NAV_FORWARD);
      break;

    case NAV_ROTATE:
      pivotRight(150);
      if (now - stateStartMs > 2400) setNavState(NAV_FORWARD);
      break;

    case NAV_HOMING: {
      unsigned long elapsed = now - stateStartMs;
      if      (elapsed < 2000)  pivotLeft(150);
      else if (elapsed < 4000)  pivotRight(150);
      else if (elapsed < 7000)  driveForward(150);
      else                      setNavState(NAV_FORWARD);
      break;
    }

    case NAV_STOP:
      motorsStop();
      break;
  }
}

// ─── HOMING (RSSI) ────────────────────────────────────────────────────────────
void tickHoming() {
  if (!WiFi.isConnected()) return;
  int rssi = WiFi.RSSI();
  if (!rssiHomeSet) { rssiHome = rssi; rssiHomeSet = true; }

  int drop = rssiHome - rssi;
  if (drop >= 12) {
    if (rssiDropStart == 0) rssiDropStart = millis();
    if (millis() - rssiDropStart > 3000 && !homingTriggered) {
      homingTriggered = true;
      setNavState(NAV_HOMING);
    }
  } else {
    rssiDropStart = 0;
    homingTriggered = false;
  }
}

// ─── SENSORS ──────────────────────────────────────────────────────────────────
void tickSensors() {
  if (millis() - lastSensorRead < 2000) return;
  lastSensorRead = millis();
  tempSensor.requestTemperatures();
  temperature = tempSensor.getTempCByIndex(0);
  flameDetected = (digitalRead(FLAME_PIN) == LOW);
}

// ─── TCP ──────────────────────────────────────────────────────────────────────
void ensureTCP() {
  if (tcpClient.connected()) return;
  if (millis() - lastReconnect < 5000) return;
  lastReconnect = millis();
  tcpClient.connect(TCP_HOST, TCP_PORT);
}

void sendTelemetry() {
  if (!tcpClient.connected()) return;
  if (millis() - lastTelemetry < 1000) return;
  lastTelemetry = millis();

  const char* navStr[] = {"forward","reverse","turn_left","turn_right","rotate","homing","stop"};
  char buf[512];
  snprintf(buf, sizeof(buf),
    "{\"ts\":%lu,\"pos\":{\"x\":%.2f,\"y\":%.2f,\"h\":%.2f},"
    "\"spd\":%d,\"temp\":%.1f,\"flame\":%s,"
    "\"ulL\":%.1f,\"ulR\":%.1f,\"hdg\":%.2f,"
    "\"nav\":\"%s\",\"sts\":\"%s\",\"mode\":\"%s\","
    "\"wifi\":%d,\"obstacles\":[{\"a\":0,\"d\":%.1f}]}\n",
    millis(), posX, posY, posH,
    (leftPWM + rightPWM) / 2,
    temperature, flameDetected ? "true" : "false",
    usL.distance, usR.distance, posH,
    navStr[navState],
    emergency ? "emergency" : (running ? "running" : "stopped"),
    driveMode == MODE_AUTO ? "autonomous" : "manual",
    WiFi.RSSI(),
    min(usL.distance, usR.distance)
  );
  tcpClient.print(buf);
}

// ─── COMMANDS ─────────────────────────────────────────────────────────────────
void handleCommand(const String &cmd) {
  if (cmd == "start")         { running = true; emergency = false; setNavState(NAV_FORWARD); }
  else if (cmd == "stop")     { running = false; motorsStop(); }
  else if (cmd == "emergency"){ emergency = true; running = false; motorsStop(); }
  else if (cmd == "mode_auto")   driveMode = MODE_AUTO;
  else if (cmd == "mode_manual") driveMode = MODE_MANUAL;
  else if (cmd == "forward")  { manualL = 150; manualR = 150; }
  else if (cmd == "backward") { manualL = -150; manualR = -150; }
  else if (cmd == "left")     { manualL = -150; manualR = 150; }
  else if (cmd == "right")    { manualL = 150; manualR = -150; }
  else if (cmd.startsWith("speed:")) {
    int s = cmd.substring(6).toInt();
    s = constrain(s, 0, 255);
    manualL = s; manualR = s;
  }

  if (driveMode == MODE_MANUAL && running && !emergency) {
    setMotor(true, manualL);
    setMotor(false, manualR);
  }
}

void readCommands() {
  if (!tcpClient.connected()) return;
  while (tcpClient.available()) {
    String line = tcpClient.readStringUntil('\n');
    line.trim();
    if (line.length()) handleCommand(line);
  }
}

// ─── SETUP / LOOP ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_L_PIN, OUTPUT); pinMode(ECHO_L_PIN, INPUT);
  pinMode(TRIG_R_PIN, OUTPUT); pinMode(ECHO_R_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);

  motorsInit();
  tempSensor.begin();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long wt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - wt < 10000) delay(200);
  digitalWrite(LED_PIN, WiFi.isConnected() ? HIGH : LOW);

  lastOdoTime = millis();
 

}

void loop() {
  tickUltrasonic();
  tickSensors();
  updateOdometry();
  tickHoming();
  tickNavigation();
  ensureTCP();
  readCommands();
  sendTelemetry();
  digitalWrite(LED_PIN, WiFi.isConnected() ? HIGH : LOW);
}
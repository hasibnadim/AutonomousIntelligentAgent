/**
 * Door Access MCU (ESP32)
 *
 * Flow: keypad ID → LOOKUP → enroll (SET) or verify (GET) tap pattern → door
 *
 * Tap input: TTP223 capacitive touch on GPIO 32 (SIG).
 *   Module: VCC→3.3V, GND→GND, SIG→GPIO32
 *   Use momentary mode (not toggle). Default modules are active-HIGH on touch.
 * Exit button: GPIO 35 → open door, auto-close after delay.
 *   Wire: 10k pull-up 35→3.3V, button between 35 and GND (pressed = LOW).
 *   (GPIO 35 is input-only — no internal pull-up.)
 * Alarm buzzer: GPIO 13 — danger tone 5s after 3 wrong verify patterns.
 * Pattern: millisecond gaps between touches, e.g. "320,890,410"
 *
 * TCP :9000 (colon fields, newline-terminated):
 *   LOOKUP:<id>       → LOOKUP:<id>:SET|GET | ERROR:...
 *   SET:<id>:<gaps>   → SET:<id>:OK
 *   GET:<id>:<gaps>   → GET:<id>:1|0
 */

#include <ESP32Servo.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>
#include <WiFi.h>
#include <math.h>

// =============================================================================
// Configuration
// =============================================================================

// Pins
static const int SERVO_PIN    = 25;
static const int TOUCH_PIN    = 32;  // TTP223 SIG (active HIGH while touched)
static const int EXIT_BTN_PIN = 35;  // pushbutton → open door (active LOW)
static const int BUZZER_PIN   = 26;  // short feedback beeps
static const int ALARM_PIN    = 13;  // danger alarm after 3 failed verifies
static const int LED_PIN      = 33;
static const int LCD_SDA      = 21;
static const int LCD_SCL      = 22;

// Tap capture (TTP223)
static const int      TAP_MAX_COUNT     = 7;
static const int      TAP_MIN_COUNT     = 3;
static const unsigned TAP_DEBOUNCE_MS   = 50;     // touch chatter
static const unsigned TAP_WINDOW_MS     = 150;    // closer taps = same knock
static const unsigned TAP_END_IDLE_MS   = 3000;   // silence → end pattern
static const unsigned TAP_FIRST_WAIT_MS = 20000;  // wait for first tap
static const unsigned TAP_SETTLE_MS     = 400;    // after keypad
static const unsigned TAP_INTERPASS_MS  = 800;    // enroll primary → confirm

// Exit / manual door button
static const unsigned EXIT_BTN_DEBOUNCE_MS = 40;
static const unsigned DOOR_OPEN_MS         = 2000;
static const unsigned DOOR_CLOSE_MS        = 2000;

// Intrusion alarm (GPIO 13)
static const int      MAX_FAIL_ATTEMPTS = 3;
static const unsigned ALARM_MS          = 5000;

// Network
static const char* WIFI_SSID      = "h00";
static const char* WIFI_PASSWORD  = "1234nnoo";
static const char* SERVER_HOST    = "192.168.137.1";
static const uint16_t SERVER_PORT = 9000;

// Pattern match (aligned with host biometric.ts)
static const float PATTERN_REL_TOLERANCE  = 0.28f;
static const float PATTERN_TEMPO_TOL      = 0.35f;
static const float PATTERN_MIN_MEAN_MS    = 40.0f;

// =============================================================================
// Keypad
// =============================================================================

static const byte KEYPAD_ROWS = 4;
static const byte KEYPAD_COLS = 4;

static char keypadKeys[KEYPAD_ROWS][KEYPAD_COLS] = {
  { '1', '2', '3', 'A' },
  { '4', '5', '6', 'B' },
  { '7', '8', '9', 'C' },
  { '*', '0', '#', 'D' }
};

static byte keypadRowPins[KEYPAD_ROWS] = { 4, 16, 17, 18 };   // keypad 8,7,6,5
static byte keypadColPins[KEYPAD_COLS] = { 19, 23, 14, 27 };  // keypad 4,3,2,1

static Keypad keypad = Keypad(
  makeKeymap(keypadKeys), keypadRowPins, keypadColPins, KEYPAD_ROWS, KEYPAD_COLS);

// =============================================================================
// Hardware / state
// =============================================================================

static LiquidCrystal_I2C lcd(0x27, 16, 2);
static Servo doorServo;
static WiFiClient tcpClient;

enum AccessMode { MODE_NONE = -1, MODE_VERIFY = 0, MODE_ENROLL = 1 };

static int userId = 0;
static AccessMode accessMode = MODE_NONE;
static bool capturePending = false;
static bool exitBtnWasDown = false;
static int failCount = 0;  // consecutive wrong verify patterns

// =============================================================================
// Display / feedback
// =============================================================================

static void showMessage(const String& line1, const String& line2 = "") {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1.substring(0, 16));
  lcd.setCursor(0, 1);
  lcd.print(line2.substring(0, 16));
  Serial.println(line1);
  if (line2.length()) Serial.println(line2);
}

static void silenceBuzzer() {
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}

static void beepFail() {
  tone(BUZZER_PIN, 350, 350);
  delay(350);
  silenceBuzzer();
}

static void silenceAlarm() {
  noTone(ALARM_PIN);
  digitalWrite(ALARM_PIN, LOW);
}

/** Alternating danger tone on GPIO 13 for ALARM_MS. */
static void playDangerAlarm() {
  showMessage("INTRUSION", "ALARM 5 SEC");
  Serial.println("[ALARM] 3 wrong patterns — danger tone 5s on GPIO13");

  const unsigned long endAt = millis() + ALARM_MS;
  while (millis() < endAt) {
    tone(ALARM_PIN, 2000, 180);
    delay(180);
    tone(ALARM_PIN, 700, 180);
    delay(180);
  }
  silenceAlarm();
  failCount = 0;
}

static void pulseLed() {
  digitalWrite(LED_PIN, HIGH);
  delay(TAP_DEBOUNCE_MS);
  digitalWrite(LED_PIN, LOW);
}

// =============================================================================
// Tap input (TTP223 capacitive touch — active HIGH)
// =============================================================================

static bool tapActive() {
  return digitalRead(TOUCH_PIN) == HIGH;
}

static void waitTapRelease(unsigned timeoutMs = 2000) {
  const unsigned long start = millis();
  while (tapActive() && (millis() - start) < timeoutMs) delay(5);
  delay(TAP_DEBOUNCE_MS);
}

/** Record tap timestamps. Returns count, or 0 on failure. */
static int captureTaps(unsigned long timestamps[], const char* line1, const char* line2) {
  int count = 0;
  unsigned long firstAt = 0;
  unsigned long lastAt = 0;
  bool wasActive = false;

  silenceBuzzer();
  delay(TAP_SETTLE_MS);
  waitTapRelease(500);

  showMessage(line1, line2);
  Serial.println("[TAP] TTP223 — 150ms window; 3s idle ends pattern");

  const unsigned long waitStart = millis();

  while (count < TAP_MAX_COUNT) {
    if (count == 0) {
      if (millis() - waitStart > TAP_FIRST_WAIT_MS) {
        showMessage("NO CONTACT", "RESTART SEQUENCE");
        return 0;
      }
    } else if ((millis() - lastAt) >= TAP_END_IDLE_MS) {
      Serial.println("[TAP] end (3s silence)");
      break;
    }

    const bool active = tapActive();
    // Rising edge: released → touched
    if (active && !wasActive) {
      const unsigned long now = millis();
      if (count > 0 && (now - lastAt) < TAP_WINDOW_MS) {
        wasActive = active;
        continue;
      }

      timestamps[count++] = now;
      lastAt = now;
      if (count == 1) firstAt = now;

      Serial.printf("[TAP] #%d gap=%lu t=%lu\n",
                    count,
                    count > 1 ? now - timestamps[count - 2] : 0UL,
                    now - firstAt);
      pulseLed();
    }

    wasActive = active;
    delay(1);
  }

  digitalWrite(LED_PIN, LOW);
  waitTapRelease(1000);

  if (count < TAP_MIN_COUNT) {
    showMessage("INCOMPLETE", String(count) + "/" + String(TAP_MIN_COUNT) + " TAPS");
    return 0;
  }

  showMessage("CODE LOCKED", String(count) + " TAPS");
  Serial.printf("[TAP] done count=%d\n", count);
  delay(300);
  return count;
}

// =============================================================================
// Pattern encode / confirm match
// =============================================================================

static String encodePattern(const unsigned long timestamps[], int count) {
  String gaps;
  for (int i = 1; i < count; i++) {
    if (gaps.length()) gaps += ',';
    gaps += String(timestamps[i] - timestamps[i - 1]);
  }
  return gaps;
}

static int parseGapList(const String& raw, float out[], int maxOut) {
  int n = 0;
  int start = 0;
  while (n < maxOut && start <= (int)raw.length()) {
    int comma = raw.indexOf(',', start);
    if (comma < 0) comma = (int)raw.length();
    String part = raw.substring(start, comma);
    part.trim();
    if (part.length()) out[n++] = part.toFloat();
    start = comma + 1;
    if (comma >= (int)raw.length()) break;
  }
  return n;
}

/** Absolute + relative rhythm match (aligned with host biometric.ts). */
static bool patternsMatch(const String& a, const String& b) {
  float ga[TAP_MAX_COUNT];
  float gb[TAP_MAX_COUNT];
  const int na = parseGapList(a, ga, TAP_MAX_COUNT);
  const int nb = parseGapList(b, gb, TAP_MAX_COUNT);
  if (na < 2 || na != nb) return false;

  float meanA = 0, meanB = 0;
  for (int i = 0; i < na; i++) {
    meanA += ga[i];
    meanB += gb[i];
  }
  meanA /= na;
  meanB /= nb;
  if (meanA < PATTERN_MIN_MEAN_MS || meanB < PATTERN_MIN_MEAN_MS) return false;

  const float tempoDenom = meanA > meanB ? meanA : meanB;
  if (fabsf(meanA - meanB) / tempoDenom > PATTERN_TEMPO_TOL) return false;

  for (int i = 0; i < na; i++) {
    if (fabsf((ga[i] / meanA) - (gb[i] / meanB)) > PATTERN_REL_TOLERANCE) return false;
    const float absTol = ga[i] * 0.4f > 150.0f ? ga[i] * 0.4f : 150.0f;
    if (fabsf(ga[i] - gb[i]) > absTol) return false;
  }
  return true;
}

static bool captureEncodedPattern(String& outPattern, const char* line1, const char* line2) {
  unsigned long timestamps[TAP_MAX_COUNT];
  const int count = captureTaps(timestamps, line1, line2);
  if (count < TAP_MIN_COUNT) return false;

  outPattern = encodePattern(timestamps, count);
  Serial.println("[PATTERN] " + outPattern);
  if (outPattern.length() < 3) {
    showMessage("CODE INVALID", "INSUFFICIENT DATA");
    return false;
  }
  return true;
}

// =============================================================================
// Door
// =============================================================================

static void openDoor(int id) {
  if (id > 0) {
    Serial.printf("[DOOR] granted user=%d\n", id);
    showMessage("ACCESS GRANTED", "UNIT " + String(id));
  } else {
    Serial.println("[DOOR] exit / manual open");
    showMessage("MANUAL OPEN", "EXIT BUTTON");
  }

  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(80);
  delay(DOOR_OPEN_MS);

  showMessage("SECURING", "DOOR CLOSING");
  doorServo.write(0);
  delay(DOOR_CLOSE_MS);
  doorServo.detach();

  showMessage("STANDBY", "ENTER ID + #");
}

/**
 * GPIO35 exit button: press → open door, then auto-close.
 * Active HIGH — wire button between 3.3V and GPIO35 with 10k pull-DOWN to GND.
 * (GPIO35 is input-only with no internal pull, so external resistor is needed.)
 * If no pull-down: a floating pin reads LOW at idle, HIGH when pressed via 3.3V.
 */
static void pollExitButton() {
  const bool pressed = (digitalRead(EXIT_BTN_PIN) == HIGH);

  if (!pressed) {
    exitBtnWasDown = false;
    return;
  }

  if (exitBtnWasDown) return;

  delay(EXIT_BTN_DEBOUNCE_MS);
  if (digitalRead(EXIT_BTN_PIN) != HIGH) return;

  exitBtnWasDown = true;
  capturePending = false;
  userId = 0;
  accessMode = MODE_NONE;
  openDoor(0);
}

// =============================================================================
// Network / protocol
// =============================================================================

static bool ensureTcpConnected() {
  if (tcpClient.connected()) return true;

  showMessage("UPLINK...", SERVER_HOST);
  if (tcpClient.connect(SERVER_HOST, SERVER_PORT)) {
    showMessage("UPLINK SECURE", "PORT 9000");
    return true;
  }

  showMessage("UPLINK FAILED", "CHECK HOST");
  return false;
}

/** Block until host TCP is up — keep error on LCD (never jump to standby). */
static void waitForUplink() {
  while (!ensureTcpConnected()) {
    delay(2000);
  }
  delay(400);
}

static String fieldAt(const String& line, int index) {
  int start = 0;
  int found = 0;
  for (int i = 0; i <= (int)line.length(); i++) {
    if (i == (int)line.length() || line.charAt(i) == ':') {
      if (found == index) return line.substring(start, i);
      found++;
      start = i + 1;
    }
  }
  return "";
}

static String sendCommand(const String& cmd) {
  if (!ensureTcpConnected()) return "ERROR:NO_TCP";

  tcpClient.println(cmd);
  tcpClient.flush();

  const unsigned long startMs = millis();
  while (!tcpClient.available()) {
    if (!tcpClient.connected()) return "ERROR:DISCONNECTED";
    if (millis() - startMs > 5000) return "ERROR:TIMEOUT";
    delay(10);
  }

  String reply = tcpClient.readStringUntil('\n');
  reply.trim();
  reply.replace("\r", "");
  Serial.println("TX " + cmd);
  Serial.println("RX " + reply);
  return reply;
}

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  showMessage("NET ACQUIRE", WIFI_SSID);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print('.');
  }

  showMessage("NET ONLINE", WiFi.localIP().toString());
  waitForUplink();
}

// =============================================================================
// Access flow
// =============================================================================

static void resetInput() {
  userId = 0;
  accessMode = MODE_NONE;
  capturePending = false;
}

static void returnToStandby(unsigned delayMs = 900) {
  delay(delayMs);
  resetInput();
  if (failCount > 0) {
    showMessage("STANDBY", "FAILS " + String(failCount) + "/" + String(MAX_FAIL_ATTEMPTS));
  } else {
    showMessage("STANDBY", "ENTER ID + #");
  }
}

/** Count a failed verify; alarm at MAX_FAIL_ATTEMPTS. */
static void registerAuthFail(const char* reason) {
  failCount++;
  Serial.printf("[AUTH] fail %d/%d (%s)\n", failCount, MAX_FAIL_ATTEMPTS, reason);
  showMessage("ACCESS DENIED", "FAIL " + String(failCount) + "/" + String(MAX_FAIL_ATTEMPTS));
  beepFail();
  delay(1000);

  if (failCount >= MAX_FAIL_ATTEMPTS) {
    playDangerAlarm();
  }
  returnToStandby(0);
}

static void runEnroll() {
  String primary;
  String confirm;

  showMessage("ENROLL MODE", "PRIMARY CODE");
  delay(200);
  if (!captureEncodedPattern(primary, "TOUCH PAD", "FIRST PASS")) {
    delay(1000);
    returnToStandby(0);
    return;
  }

  silenceBuzzer();
  showMessage("CONFIRM NEXT", "HOLD STEADY");
  delay(TAP_INTERPASS_MS);

  showMessage("CONFIRM CODE", "REPEAT EXACTLY");
  delay(300);
  if (!captureEncodedPattern(confirm, "TOUCH PAD", "SECOND PASS")) {
    delay(1000);
    returnToStandby(0);
    return;
  }

  if (!patternsMatch(primary, confirm)) {
    showMessage("MISMATCH", "ENROLL ABORTED");
    beepFail();
    delay(1000);
    returnToStandby(0);
    return;
  }

  showMessage("CODES MATCH", "UPLOADING...");
  const String reply = sendCommand("SET:" + String(userId) + ":" + primary);
  if (fieldAt(reply, 0) == "SET" && fieldAt(reply, 2) == "OK") {
    showMessage("ENROLL COMPLETE", "UNIT " + String(userId));
    returnToStandby(1000);
    return;
  }

  // Keep link error on LCD — do not drop into standby.
  if (reply.startsWith("ERROR:")) {
    showMessage("UPLINK FAILED", reply.substring(6, 22));
    beepFail();
    resetInput();
    return;
  }

  showMessage("UPLOAD FAILED", reply.substring(0, 16));
  returnToStandby(1000);
}

static void runVerify() {
  String attempt;

  showMessage("AUTH MODE", "PRESENT CODE");
  delay(200);
  if (!captureEncodedPattern(attempt, "TOUCH PAD", "TAP PATTERN")) {
    // Incomplete / abandoned pattern still counts toward lockout.
    registerAuthFail("incomplete");
    return;
  }

  showMessage("VERIFYING", "STAND BY");
  const String reply = sendCommand("GET:" + String(userId) + ":" + attempt);
  if (fieldAt(reply, 0) == "GET" && fieldAt(reply, 2) == "1") {
    failCount = 0;
    openDoor(userId);
    resetInput();
    return;
  }

  // Network / host errors are not pattern fails — stay on error screen.
  if (reply.startsWith("ERROR:") || fieldAt(reply, 0) != "GET") {
    showMessage("UPLINK FAILED", reply.startsWith("ERROR:") ? reply.substring(6, 22) : "CHECK HOST");
    beepFail();
    resetInput();
    return;
  }

  registerAuthFail("mismatch");
}

static void handlePatternCapture() {
  capturePending = false;

  if (accessMode == MODE_ENROLL) {
    runEnroll();
    return;
  }
  if (accessMode == MODE_VERIFY) {
    runVerify();
    return;
  }

  showMessage("NO TARGET", "UNKNOWN UNIT");
  delay(1000);
  returnToStandby(0);
}

static void lookupUser() {
  showMessage("QUERY UNIT", String(userId));
  const String reply = sendCommand("LOOKUP:" + String(userId));
  const String cmd = fieldAt(reply, 0);
  const String status = fieldAt(reply, 2);

  if (cmd == "LOOKUP" && status == "SET") {
    accessMode = MODE_ENROLL;
    capturePending = true;
    showMessage("NEW RECRUIT", "ENROLL REQUIRED");
  } else if (cmd == "LOOKUP" && status == "GET") {
    accessMode = MODE_VERIFY;
    capturePending = true;
    showMessage("CLEARANCE CHK", "AUTH REQUIRED");
  } else if (reply.startsWith("ERROR:") || cmd == "ERROR") {
    // Keep UPLINK FAILED / host error on LCD — no standby.
    showMessage("UPLINK FAILED", reply.startsWith("ERROR:") ? reply.substring(6, 22) : "CHECK HOST");
    beepFail();
    resetInput();
  } else {
    showMessage("UNKNOWN UNIT", "ID " + String(userId));
    returnToStandby(1000);
  }
}

static void handleKey(char key) {
  if (key >= '0' && key <= '9') {
    userId = userId * 10 + (key - '0');
    if (userId > 999999) userId = key - '0';
    showMessage("UNIT ID", String(userId));
    return;
  }

  if (key == '*') {
    resetInput();
    showMessage("CLEARED", "ENTER ID + #");
    return;
  }

  if (key == '#') {
    if (userId <= 0) {
      showMessage("INVALID ID", "RE-ENTER UNIT");
      return;
    }
    lookupUser();
  }
}

static void initHardware() {
  // TTP223 drives SIG high/low itself — no pull-up (active HIGH on touch).
  pinMode(TOUCH_PIN, INPUT);
  // GPIO35 is input-only (no internal pull). Active HIGH: idle=LOW, pressed=HIGH.
  // Wire: 10k pull-down (35→GND), button between 35 and 3.3V.
  pinMode(EXIT_BTN_PIN, INPUT);
  exitBtnWasDown = false;
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
  pinMode(BUZZER_PIN, OUTPUT);
  silenceBuzzer();
  pinMode(ALARM_PIN, OUTPUT);
  silenceAlarm();

  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();

  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(0);
  delay(400);
  doorServo.detach();
}

// =============================================================================
// Arduino entry
// =============================================================================

void setup() {
  Serial.begin(115200);
  delay(200);

  initHardware();
  showMessage("SYSTEM BOOT", "DOOR ACCESS");
  delay(400);
  connectWifi();  // blocks on UPLINK FAILED until host is reachable
  showMessage("STANDBY", "ENTER ID + #");
}

void loop() {
  // Manual / exit button always wins (even during enroll/verify).
  pollExitButton();

  if (capturePending) {
    handlePatternCapture();
    return;
  }

  const char key = keypad.getKey();
  if (key) handleKey(key);
}

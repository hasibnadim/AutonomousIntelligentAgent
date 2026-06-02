#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "wifi_manager.h"
#include "tcp_client.h"
#include "sensors.h"
#include "motor_controller.h"

// ── Vehicle state ──
static String mode = "autonomous";
static String status = "idle";
static int heading = 0;
static float latitude = 23.8103;
static float longitude = 90.4125;
static int speed = 0;
static int throttle = 0;

// ── Forward declarations ──
void handle_command(const char* cmd);
void send_telemetry();

// ── Telemetry JSON builder ──
static void build_telemetry_json(String& buf) {
  SensorData s = sensors_read();
  buf = "{\"speed\":";
  buf += speed;
  buf += ",\"batteryLevel\":85,\"batteryVoltage\":12.4";
  buf += ",\"temperature\":";
  buf += String(s.temperature, 1);
  buf += ",\"flameDetected\":";
  buf += s.flameDetected ? "true" : "false";
  buf += ",\"ultrasonicDistance\":";
  buf += String(s.ultrasonicDistance, 0);
  buf += ",\"heading\":";
  buf += heading;
  buf += ",\"latitude\":";
  buf += String(latitude, 6);
  buf += ",\"longitude\":";
  buf += String(longitude, 6);
  buf += ",\"altitude\":12";
  buf += ",\"status\":\"";
  buf += status;
  buf += "\",\"mode\":\"";
  buf += mode;
  buf += "\",\"targetLat\":23.812,\"targetLng\":90.415";
  buf += ",\"wifiSignal\":";
  buf += s.wifiRssi;
  buf += "}";
}

// ── Movement in manual mode ──
static void update_position() {
  if (mode == "manual" && status == "running" && throttle != 0) {
    float rad = heading * DEG_TO_RAD;
    float step = throttle * 0.000003;
    latitude += cos(rad) * step;
    longitude += sin(rad) * step;
  }
  if (mode == "autonomous" && status == "running") {
    float rad = heading * DEG_TO_RAD;
    latitude += cos(rad) * 0.00005;
    longitude += sin(rad) * 0.00005;
  }
}

// ── Command handler ──
void handle_command(const char* cmd) {
  String c = String(cmd);
  c.trim();
  Serial.print("CMD: ");
  Serial.println(c);

  if (c == "start") {
    status = "running";
    speed = 120;
    motor_forward(speed);
  } else if (c == "stop") {
    status = "idle";
    speed = 0; throttle = 0;
    motor_stop();
  } else if (c == "emergency") {
    status = "emergency";
    speed = 0; throttle = 0;
    motor_stop();
  } else if (c == "mode_auto") {
    mode = "autonomous";
    speed = 0; throttle = 0;
    motor_stop();
  } else if (c == "mode_manual") {
    mode = "manual";
    speed = 0; throttle = 0;
    motor_stop();
  } else if (c == "forward") {
    if (mode != "manual") return;
    speed = constrain(speed + 20, MIN_SPEED, MAX_SPEED);
    motor_forward(speed);
    status = "running";
  } else if (c == "backward") {
    if (mode != "manual") return;
    speed = constrain(speed + 20, MIN_SPEED, MAX_SPEED);
    motor_backward(speed);
    status = "running";
  } else if (c == "home") {
    mode = "autonomous";
    status = "running";
    speed = 120;
    motor_forward(speed);
  } else if (c.startsWith("heading:")) {
    int h = c.substring(8).toInt();
    heading = (h % 360 + 360) % 360;
  } else if (c.startsWith("throttle:")) {
    throttle = constrain(c.substring(9).toFloat() * MAX_SPEED, -MAX_SPEED, MAX_SPEED);
    speed = abs(throttle);
    if (throttle > 0) motor_forward(speed);
    else if (throttle < 0) motor_backward(speed);
    else motor_stop();
    status = (throttle != 0) ? "running" : "idle";
  } else if (c.startsWith("goto:")) {
    mode = "autonomous";
    status = "running";
    speed = 120;
    motor_forward(speed);
  }
}

// ── Telemetry sender ──
void send_telemetry() {
  String json;
  build_telemetry_json(json);
  tcp_send(json.c_str());
}

// ── Arduino entry points ──
void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  sensors_init();
  motor_init();
  wifi_init(WIFI_SSID, WIFI_PASSWORD);
  tcp_init(TCP_HOST, TCP_PORT);
  tcp_set_callbacks(nullptr, handle_command);
}

static unsigned long lastTelemetry = 0;
static unsigned long lastPosUpdate = 0;

void loop() {
  tcp_loop();

  unsigned long now = millis();

  // Update position every 50ms
  if (now - lastPosUpdate > 50) {
    lastPosUpdate = now;
    update_position();
  }

  // Send telemetry every 500ms
  if (now - lastTelemetry > 500) {
    lastTelemetry = now;
    send_telemetry();
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
}

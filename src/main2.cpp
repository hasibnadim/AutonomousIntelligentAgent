#include <Arduino.h>
#include <WiFi.h>
#include "config.h"
#include "wifi_manager.h"
#include "tcp_client.h"
#include "sensors.h"
#include "motor_controller.h"
#include "navigation.h"

// ── Vehicle state ──
static String mode = "autonomous";
static String status = "running";
static int heading = 0;
static NavState currentNavState = NAV_IDLE;

// ── Forward declarations ──
void handle_command(const char* cmd);
void send_telemetry();
static void build_telemetry_json(String& buf);

// ── Telemetry JSON builder ──
static void build_telemetry_json(String& buf, NavState ns) {
  SensorData s = sensors_read();
  buf = "{\"speed\":";
  buf += DEFAULT_SPEED;
  buf += ",\"temperature\":";
  buf += String(s.temperature, 1);
  buf += ",\"flameDetected\":";
  buf += s.flameDetected ? "true" : "false";
  buf += ",\"ultrasonicLeft\":";
  buf += String(s.ultrasonicLeft, 0);
  buf += ",\"ultrasonicRight\":";
  buf += String(s.ultrasonicRight, 0);
  buf += ",\"heading\":";
  buf += heading;
  buf += ",\"navState\":\"";
  buf += nav_state_name(ns);
  buf += "\",\"status\":\"";
  buf += status;
  buf += "\",\"mode\":\"";
  buf += mode;
  buf += "\",\"wifiSignal\":";
  buf += s.wifiRssi;
  buf += ",";
  nav_build_map_json(buf);
  buf += "}";
}

// ── Command handler ──
void handle_command(const char* cmd) {
  String c = String(cmd);
  c.trim();
  Serial.print("CMD: ");
  Serial.println(c);

  if (c == "start") {
    mode = "autonomous";
    status = "running";
    nav_reset();
  } else if (c == "stop") {
    status = "idle";
    nav_stop();
  } else if (c == "emergency") {
    status = "emergency";
    nav_stop();
  } else if (c == "mode_auto") {
    mode = "autonomous";
    status = "running";
    nav_reset();
  } else if (c == "mode_manual") {
    mode = "manual";
    status = "idle";
    nav_force_manual();
  } else if (c == "forward") {
    if (mode != "manual") return;
    status = "running";
    motor_forward(DEFAULT_SPEED);
  } else if (c == "backward") {
    if (mode != "manual") return;
    status = "running";
    motor_backward(DEFAULT_SPEED);
  } else if (c == "left") {
    if (mode != "manual") return;
    status = "running";
    motor_turn_left(DEFAULT_SPEED);
  } else if (c == "right") {
    if (mode != "manual") return;
    status = "running";
    motor_turn_right(DEFAULT_SPEED);
  } else if (c.startsWith("speed:")) {
    if (mode != "manual") return;
    int s = constrain(c.substring(6).toInt(), 0, MAX_SPEED);
    if (s == 0) motor_stop();
    else motor_forward(s);
    status = (s > 0) ? "running" : "idle";
  }
}

// ── Telemetry sender ──
void send_telemetry() {
  String json;
  build_telemetry_json(json, currentNavState);
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

  int rssi = WiFi.RSSI();
  nav_init(rssi);
  nav_reset();

  digitalWrite(LED_PIN, HIGH);

  tcp_init(TCP_HOST, TCP_PORT);
  tcp_set_callbacks(nullptr, handle_command);
}

static unsigned long lastTel = 0;

void loop() {
  tcp_loop();

  if (mode == "autonomous" && status != "idle") {
    float left = read_ultrasonic_left();
    float right = read_ultrasonic_right();
    int rssi = WiFi.RSSI();
    currentNavState = nav_update(left, right, rssi);
  }

  unsigned long now = millis();
  if (now - lastTel > 500) {
    lastTel = now;
    send_telemetry();
  }

  delay(10);
}

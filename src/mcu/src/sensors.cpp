#include "sensors.h"
#include "config.h"
#include <WiFi.h>

static float read_temp() {
  int raw = analogRead(TEMP_PIN);
  float voltage = raw * (3.3f / 4095.0f);
  return (voltage - 0.5f) * 100.0f;
}

static float read_ultrasonic() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return 999;
  return duration * 0.034f / 2.0f;
}

void sensors_init() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(TEMP_PIN, INPUT);
  pinMode(FLAME_PIN, INPUT_PULLUP);
}

SensorData sensors_read() {
  SensorData d;
  d.temperature = read_temp();
  d.flameDetected = digitalRead(FLAME_PIN) == LOW;
  d.ultrasonicDistance = read_ultrasonic();
  d.wifiRssi = WiFi.RSSI();
  return d;
}

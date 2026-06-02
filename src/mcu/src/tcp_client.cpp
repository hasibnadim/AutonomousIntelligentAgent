#include "tcp_client.h"
#include <WiFi.h>

static WiFiClient client;
static String host;
static uint16_t port;
static TelemetryCallback onTelemetry = nullptr;
static CommandCallback onCommand = nullptr;
static unsigned long lastReconnect = 0;
static String rxBuf;

void tcp_init(const char* h, uint16_t p) {
  host = h;
  port = p;
}

void tcp_set_callbacks(TelemetryCallback onTel, CommandCallback onCmd) {
  onTelemetry = onTel;
  onCommand = onCmd;
}

static bool connect_server() {
  if (WiFi.status() != WL_CONNECTED) return false;
  Serial.print("Connecting to ");
  Serial.print(host); Serial.print(":"); Serial.println(port);

  if (client.connect(host.c_str(), port)) {
    Serial.println("TCP connected");
    return true;
  }
  Serial.println("TCP failed");
  return false;
}

void tcp_send(const char* data) {
  if (!client.connected()) return;
  client.println(data);
}

void tcp_loop() {
  if (!client.connected()) {
    if (millis() - lastReconnect > 5000) {
      lastReconnect = millis();
      connect_server();
    }
    return;
  }

  while (client.available()) {
    char c = client.read();
    if (c == '\n' || c == '\r') {
      if (rxBuf.length() > 0) {
        if (onCommand) onCommand(rxBuf.c_str());
        rxBuf = "";
      }
    } else {
      rxBuf += c;
    }
  }
}

bool tcp_is_connected() {
  return client.connected();
}

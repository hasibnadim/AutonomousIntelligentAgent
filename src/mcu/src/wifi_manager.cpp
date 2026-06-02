#include "wifi_manager.h"
#include <WiFi.h>

void wifi_init(const char* ssid, const char* password) {
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  Serial.print("Connecting to WiFi");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    wifi_print_status();
  } else {
    Serial.println("\nWiFi failed - check credentials");
  }
}

bool wifi_is_connected() {
  return WiFi.status() == WL_CONNECTED;
}

void wifi_print_status() {
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  Serial.print("RSSI: ");
  Serial.println(WiFi.RSSI());
}

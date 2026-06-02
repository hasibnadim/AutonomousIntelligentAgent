#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>

struct SensorData {
  float temperature;
  bool  flameDetected;
  float ultrasonicDistance; // cm
  int   wifiRssi;
};

void sensors_init();
SensorData sensors_read();

#endif

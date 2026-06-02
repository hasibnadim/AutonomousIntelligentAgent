#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>

void wifi_init(const char* ssid, const char* password);
bool wifi_is_connected();
void wifi_print_status();

#endif

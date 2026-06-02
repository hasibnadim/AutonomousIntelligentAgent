#ifndef TCP_CLIENT_H
#define TCP_CLIENT_H

#include <Arduino.h>
#include <functional>

using TelemetryCallback = std::function<void(const char* json)>;
using CommandCallback = std::function<void(const char* cmd)>;

void tcp_init(const char* host, uint16_t port);
void tcp_set_callbacks(TelemetryCallback onTel, CommandCallback onCmd);
void tcp_send(const char* data);
void tcp_loop();
bool tcp_is_connected();

#endif

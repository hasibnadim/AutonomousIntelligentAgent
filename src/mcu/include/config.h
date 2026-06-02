#ifndef CONFIG_H
#define CONFIG_H

// WiFi credentials (laptop hotspot)
#define WIFI_SSID      "YOUR_HOTSPOT_SSID"
#define WIFI_PASSWORD  "YOUR_HOTSPOT_PASSWORD"

// Dashboard TCP server
#define TCP_HOST       "192.168.137.1"
#define TCP_PORT       9000

// L298N Motor Driver
#define MOTOR_ENA  13
#define MOTOR_IN1  12
#define MOTOR_IN2  14
#define MOTOR_ENB  27
#define MOTOR_IN3  26
#define MOTOR_IN4  25

// HC-SR04 Ultrasonic
#define TRIG_PIN   5
#define ECHO_PIN   18

// Sensors
#define TEMP_PIN   34
#define FLAME_PIN  35

// GPS (optional - connect to UART2)
#define GPS_RX     16
#define GPS_TX     17

// LED indicator
#define LED_PIN    2

// Defaults
#define DEFAULT_SPEED  180   // PWM 0-255
#define MIN_SPEED      100
#define MAX_SPEED      255

#endif

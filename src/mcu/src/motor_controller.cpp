#include "motor_controller.h"
#include "config.h"

void motor_init() {
  pinMode(MOTOR_ENA, OUTPUT);
  pinMode(MOTOR_IN1, OUTPUT);
  pinMode(MOTOR_IN2, OUTPUT);
  pinMode(MOTOR_ENB, OUTPUT);
  pinMode(MOTOR_IN3, OUTPUT);
  pinMode(MOTOR_IN4, OUTPUT);

  digitalWrite(MOTOR_IN1, LOW);
  digitalWrite(MOTOR_IN2, LOW);
  digitalWrite(MOTOR_IN3, LOW);
  digitalWrite(MOTOR_IN4, LOW);
  analogWrite(MOTOR_ENA, 0);
  analogWrite(MOTOR_ENB, 0);
}

void motor_set_speed(int left, int right) {
  int l = constrain(left, -255, 255);
  int r = constrain(right, -255, 255);

  digitalWrite(MOTOR_IN1, l > 0 ? HIGH : LOW);
  digitalWrite(MOTOR_IN2, l < 0 ? HIGH : LOW);
  digitalWrite(MOTOR_IN3, r > 0 ? HIGH : LOW);
  digitalWrite(MOTOR_IN4, r < 0 ? HIGH : LOW);

  analogWrite(MOTOR_ENA, abs(l));
  analogWrite(MOTOR_ENB, abs(r));
}

void motor_stop() {
  motor_set_speed(0, 0);
}

void motor_forward(int speed) {
  motor_set_speed(speed, speed);
}

void motor_backward(int speed) {
  motor_set_speed(-speed, -speed);
}

void motor_turn_left(int speed) {
  motor_set_speed(-speed, speed);
}

void motor_turn_right(int speed) {
  motor_set_speed(speed, -speed);
}

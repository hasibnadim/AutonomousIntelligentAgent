#ifndef MOTOR_CONTROLLER_H
#define MOTOR_CONTROLLER_H

#include <Arduino.h>

void motor_init();
void motor_set_speed(int left, int right);
void motor_stop();
void motor_forward(int speed);
void motor_backward(int speed);
void motor_turn_left(int speed);
void motor_turn_right(int speed);

#endif

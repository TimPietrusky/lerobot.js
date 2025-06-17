/**
 * SO-100 device configurations
 * Defines the differences between leader and follower devices
 * Mirrors Python lerobot device configuration approach
 */

import type { SO100CalibrationConfig } from "./calibration.js";
import { SerialPort } from "serialport";

/**
 * Common motor names for all SO-100 devices
 */
const SO100_MOTOR_NAMES = [
  "shoulder_pan",
  "shoulder_lift",
  "elbow_flex",
  "wrist_flex",
  "wrist_roll",
  "gripper",
];

/**
 * SO-100 Follower Configuration
 * Robot arm that performs tasks autonomously
 * Uses standard gear ratios for all motors
 */
export function createSO100FollowerConfig(
  port: SerialPort
): SO100CalibrationConfig {
  return {
    deviceType: "so100_follower",
    port,
    motorNames: SO100_MOTOR_NAMES,

    // Follower uses standard drive modes (all same gear ratio)
    driveModes: [0, 0, 0, 0, 0, 0], // All 1/345 gear ratio

    // Calibration modes
    calibModes: ["DEGREE", "DEGREE", "DEGREE", "DEGREE", "DEGREE", "LINEAR"],

    // Follower limits - optimized for autonomous operation
    limits: {
      position_min: [-180, -90, -90, -90, -90, -90],
      position_max: [180, 90, 90, 90, 90, 90],
      velocity_max: [100, 100, 100, 100, 100, 100], // Fast for autonomous tasks
      torque_max: [50, 50, 50, 50, 25, 25], // Higher torque for carrying loads
    },
  };
}

/**
 * SO-100 Leader Configuration
 * Teleoperator arm that humans use to control the follower
 * Uses mixed gear ratios for easier human operation
 */
export function createSO100LeaderConfig(
  port: SerialPort
): SO100CalibrationConfig {
  return {
    deviceType: "so100_leader",
    port,
    motorNames: SO100_MOTOR_NAMES,

    // Leader uses mixed gear ratios for easier human operation
    // Based on Python lerobot leader calibration data
    driveModes: [0, 1, 0, 0, 1, 0], // Mixed ratios: some 1/345, some 1/191, some 1/147

    // Same calibration modes as follower
    calibModes: ["DEGREE", "DEGREE", "DEGREE", "DEGREE", "DEGREE", "LINEAR"],

    // Leader limits - optimized for human operation (safer, easier to move)
    limits: {
      position_min: [-120, -60, -60, -60, -180, -45],
      position_max: [120, 60, 60, 60, 180, 45],
      velocity_max: [80, 80, 80, 80, 120, 60], // Slower for human control
      torque_max: [30, 30, 30, 30, 20, 15], // Lower torque for safety
    },
  };
}

/**
 * Get configuration for any SO-100 device type
 */
export function getSO100Config(
  deviceType: "so100_follower" | "so100_leader",
  port: SerialPort
): SO100CalibrationConfig {
  switch (deviceType) {
    case "so100_follower":
      return createSO100FollowerConfig(port);
    case "so100_leader":
      return createSO100LeaderConfig(port);
    default:
      throw new Error(`Unknown SO-100 device type: ${deviceType}`);
  }
}

/**
 * SO-100 device configurations
 * Defines the differences between leader and follower devices
 * Mirrors Python lerobot device configuration approach
 */

import type { SO100CalibrationConfig } from "../types/calibration.js";
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
 * Common motor IDs for all SO-100 devices (STS3215 servos)
 */
const SO100_MOTOR_IDS = [1, 2, 3, 4, 5, 6];

/**
 * Protocol configuration for STS3215 motors used in SO-100 devices
 */
interface STS3215Protocol {
  resolution: number;
  homingOffsetAddress: number;
  homingOffsetLength: number;
  presentPositionAddress: number;
  presentPositionLength: number;
  minPositionLimitAddress: number;
  minPositionLimitLength: number;
  maxPositionLimitAddress: number;
  maxPositionLimitLength: number;
  signMagnitudeBit: number; // Bit 11 is sign bit for Homing_Offset encoding
}

/**
 * STS3215 Protocol Configuration
 * These addresses and settings are specific to the STS3215 servo motors
 */
export const STS3215_PROTOCOL: STS3215Protocol = {
  resolution: 4096, // 12-bit resolution (0-4095)
  homingOffsetAddress: 31, // Address for Homing_Offset register
  homingOffsetLength: 2, // 2 bytes for Homing_Offset
  presentPositionAddress: 56, // Address for Present_Position register
  presentPositionLength: 2, // 2 bytes for Present_Position
  minPositionLimitAddress: 9, // Address for Min_Position_Limit register
  minPositionLimitLength: 2, // 2 bytes for Min_Position_Limit
  maxPositionLimitAddress: 11, // Address for Max_Position_Limit register
  maxPositionLimitLength: 2, // 2 bytes for Max_Position_Limit
  signMagnitudeBit: 11, // Bit 11 is sign bit for Homing_Offset encoding
} as const;

/**
 * SO-100 Follower Configuration
 * Robot arm that performs tasks autonomously
 * Drive modes match Python lerobot exactly: all motors use drive_mode=0
 */
export function createSO100FollowerConfig(
  port: SerialPort
): SO100CalibrationConfig {
  return {
    deviceType: "so100_follower",
    port,
    motorNames: SO100_MOTOR_NAMES,
    motorIds: SO100_MOTOR_IDS,
    protocol: STS3215_PROTOCOL,

    // Python lerobot uses drive_mode=0 for all motors (current format)
    driveModes: [0, 0, 0, 0, 0, 0],

    // Calibration modes (not used in current implementation, but kept for compatibility)
    calibModes: ["DEGREE", "DEGREE", "DEGREE", "DEGREE", "DEGREE", "LINEAR"],

    // Follower limits - these are not used in calibration file format
    limits: {
      position_min: [-180, -90, -90, -90, -90, -90],
      position_max: [180, 90, 90, 90, 90, 90],
      velocity_max: [100, 100, 100, 100, 100, 100],
      torque_max: [50, 50, 50, 50, 25, 25],
    },
  };
}

/**
 * SO-100 Leader Configuration
 * Teleoperator arm that humans use to control the follower
 * Drive modes match Python lerobot exactly: all motors use drive_mode=0
 */
export function createSO100LeaderConfig(
  port: SerialPort
): SO100CalibrationConfig {
  return {
    deviceType: "so100_leader",
    port,
    motorNames: SO100_MOTOR_NAMES,
    motorIds: SO100_MOTOR_IDS,
    protocol: STS3215_PROTOCOL,

    // Python lerobot uses drive_mode=0 for all motors (current format)
    driveModes: [0, 0, 0, 0, 0, 0],

    // Same calibration modes as follower
    calibModes: ["DEGREE", "DEGREE", "DEGREE", "DEGREE", "DEGREE", "LINEAR"],

    // Leader limits - these are not used in calibration file format
    limits: {
      position_min: [-120, -60, -60, -60, -180, -45],
      position_max: [120, 60, 60, 60, 180, 45],
      velocity_max: [80, 80, 80, 80, 120, 60],
      torque_max: [30, 30, 30, 30, 20, 15],
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

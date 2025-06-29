/**
 * SO-100 specific hardware configuration
 */

import type { RobotHardwareConfig } from "../types/robot-config.js";

/**
 * STS3215 Protocol Configuration for SO-100 devices
 */
export const WEB_STS3215_PROTOCOL = {
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
 * SO-100 Device Configuration
 * Motor names, IDs, and drive modes for both follower and leader
 */
export const SO100_CONFIG = {
  motorNames: [
    "shoulder_pan",
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper",
  ],
  motorIds: [1, 2, 3, 4, 5, 6],
  // All SO-100 motors use drive_mode=0
  driveModes: [0, 0, 0, 0, 0, 0],
};

/**
 * SO-100 Keyboard Controls for Teleoperation
 * Robot-specific mapping optimized for SO-100 joint layout
 */
export const SO100_KEYBOARD_CONTROLS = {
  // Shoulder controls
  ArrowUp: { motor: "shoulder_lift", direction: 1, description: "Shoulder up" },
  ArrowDown: {
    motor: "shoulder_lift",
    direction: -1,
    description: "Shoulder down",
  },
  ArrowLeft: {
    motor: "shoulder_pan",
    direction: -1,
    description: "Shoulder left",
  },
  ArrowRight: {
    motor: "shoulder_pan",
    direction: 1,
    description: "Shoulder right",
  },

  // WASD controls
  w: { motor: "elbow_flex", direction: 1, description: "Elbow flex" },
  s: { motor: "elbow_flex", direction: -1, description: "Elbow extend" },
  a: { motor: "wrist_flex", direction: -1, description: "Wrist down" },
  d: { motor: "wrist_flex", direction: 1, description: "Wrist up" },

  // Wrist roll and gripper
  q: { motor: "wrist_roll", direction: -1, description: "Wrist roll left" },
  e: { motor: "wrist_roll", direction: 1, description: "Wrist roll right" },
  o: { motor: "gripper", direction: 1, description: "Gripper open" },
  c: { motor: "gripper", direction: -1, description: "Gripper close" },

  // Emergency stop
  Escape: {
    motor: "emergency_stop",
    direction: 0,
    description: "Emergency stop",
  },
} as const;

/**
 * Create SO-100 hardware configuration
 */
export function createSO100Config(
  deviceType: "so100_follower" | "so100_leader"
): RobotHardwareConfig {
  return {
    deviceType,
    motorNames: SO100_CONFIG.motorNames,
    motorIds: SO100_CONFIG.motorIds,
    driveModes: SO100_CONFIG.driveModes,
    keyboardControls: SO100_KEYBOARD_CONTROLS,
    protocol: WEB_STS3215_PROTOCOL,
  };
}

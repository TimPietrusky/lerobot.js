/**
 * SO-100 specific configuration for web calibration
 * Matches Node.js SO-100 config structure and Python lerobot exactly
 */

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
  // Python lerobot uses drive_mode=0 for all SO-100 motors
  driveModes: [0, 0, 0, 0, 0, 0],
};

/**
 * Create SO-100 calibration configuration
 */
export function createSO100Config(
  deviceType: "so100_follower" | "so100_leader"
) {
  return {
    deviceType,
    motorNames: SO100_CONFIG.motorNames,
    motorIds: SO100_CONFIG.motorIds,
    driveModes: SO100_CONFIG.driveModes,
    protocol: WEB_STS3215_PROTOCOL,
  };
}

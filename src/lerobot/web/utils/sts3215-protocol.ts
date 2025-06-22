/**
 * STS3215 Protocol Constants and Configuration
 * Single source of truth for all STS3215 motor communication
 */

/**
 * STS3215 Protocol Configuration
 * Register addresses, timing, and communication constants
 */
export const STS3215_PROTOCOL = {
  // Register addresses
  PRESENT_POSITION_ADDRESS: 56,
  GOAL_POSITION_ADDRESS: 42,
  HOMING_OFFSET_ADDRESS: 31,
  MIN_POSITION_LIMIT_ADDRESS: 9,
  MAX_POSITION_LIMIT_ADDRESS: 11,
  TORQUE_ENABLE_ADDRESS: 40, // Torque Enable register (0=disable, 1=enable)

  // Protocol constants
  RESOLUTION: 4096, // 12-bit resolution (0-4095)
  SIGN_MAGNITUDE_BIT: 11, // Bit 11 is sign bit for Homing_Offset encoding

  // Data lengths
  HOMING_OFFSET_LENGTH: 2,
  PRESENT_POSITION_LENGTH: 2,
  MIN_POSITION_LIMIT_LENGTH: 2,
  MAX_POSITION_LIMIT_LENGTH: 2,

  // Communication timing (proven from calibration)
  WRITE_TO_READ_DELAY: 10,
  RETRY_DELAY: 20,
  INTER_MOTOR_DELAY: 10,
  MAX_RETRIES: 3,
} as const;

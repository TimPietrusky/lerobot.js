/**
 * Calibration types for Node.js implementation
 */

import type { SerialPort } from "serialport";

export interface SO100CalibrationConfig {
  deviceType: "so100_follower" | "so100_leader";
  port: SerialPort;
  motorNames: string[];
  motorIds: number[]; // Device-specific motor IDs (e.g., [1,2,3,4,5,6] for SO-100)
  driveModes: number[];
  calibModes: string[];

  // Protocol-specific configuration
  protocol: {
    resolution: number; // Motor resolution (e.g., 4096 for STS3215)
    homingOffsetAddress: number; // Register address for homing offset (e.g., 31 for STS3215)
    homingOffsetLength: number; // Length in bytes for homing offset register
    presentPositionAddress: number; // Register address for present position (e.g., 56 for STS3215)
    presentPositionLength: number; // Length in bytes for present position register
    minPositionLimitAddress: number; // Register address for min position limit (e.g., 9 for STS3215)
    minPositionLimitLength: number; // Length in bytes for min position limit register
    maxPositionLimitAddress: number; // Register address for max position limit (e.g., 11 for STS3215)
    maxPositionLimitLength: number; // Length in bytes for max position limit register
    signMagnitudeBit: number; // Sign bit index for homing offset encoding (e.g., 11 for STS3215)
  };

  limits: {
    position_min: number[];
    position_max: number[];
    velocity_max: number[];
    torque_max: number[];
  };
}

export interface CalibrationResults {
  [motorName: string]: {
    id: number;
    drive_mode: number;
    homing_offset: number;
    range_min: number;
    range_max: number;
  };
}

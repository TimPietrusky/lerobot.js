/**
 * Shared robot hardware configuration types
 * Used across calibration, teleoperation, and other robot operations
 */

/**
 * Keyboard control mapping for teleoperation
 */
export interface KeyboardControl {
  motor: string;
  direction: number;
  description: string;
}

/**
 * Robot hardware configuration interface
 * Defines the contract that all robot configurations must implement
 */
export interface RobotHardwareConfig {
  deviceType: string;
  motorNames: string[];
  motorIds: number[];
  driveModes: number[];

  // Keyboard controls for teleoperation (robot-specific)
  keyboardControls: { [key: string]: KeyboardControl };

  protocol: {
    resolution: number;
    homingOffsetAddress: number;
    homingOffsetLength: number;
    presentPositionAddress: number;
    presentPositionLength: number;
    minPositionLimitAddress: number;
    minPositionLimitLength: number;
    maxPositionLimitAddress: number;
    maxPositionLimitLength: number;
    signMagnitudeBit: number;
  };
}

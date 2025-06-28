/**
 * Calibration-related types for web implementation
 */

/**
 * Calibration results structure matching Python lerobot format exactly
 */
export interface WebCalibrationResults {
  [motorName: string]: {
    id: number;
    drive_mode: number;
    homing_offset: number;
    range_min: number;
    range_max: number;
  };
}

/**
 * Live calibration data with current positions and ranges
 */
export interface LiveCalibrationData {
  [motorName: string]: {
    current: number;
    min: number;
    max: number;
    range: number;
  };
}

/**
 * Calibration process control object
 */
export interface CalibrationProcess {
  stop(): void;
  result: Promise<WebCalibrationResults>;
}

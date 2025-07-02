/**
 * Calibration-related types for web implementation
 */

import type { RobotConnection } from "./robot-connection.js";

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
 * Config for calibrate function
 */
export interface CalibrateConfig {
  robot: RobotConnection;
  onLiveUpdate?: (data: LiveCalibrationData) => void;
  onProgress?: (message: string) => void;
}

/**
 * Calibration results structure
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
 * Calibration process control object
 */
export interface CalibrationProcess {
  stop(): void;
  result: Promise<WebCalibrationResults>;
}

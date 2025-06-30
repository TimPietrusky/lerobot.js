/**
 * Constants for lerobot.js
 * Mirrors Python lerobot/common/constants.py
 */

import { homedir } from "os";
import { join } from "path";

// Device types
export const ROBOTS = "robots";
export const TELEOPERATORS = "teleoperators";

/**
 * Get HF Home directory
 * Equivalent to Python's huggingface_hub.constants.HF_HOME
 */
export function getHfHome(): string {
  if (process.env.HF_HOME) {
    return process.env.HF_HOME;
  }

  const homeDir = homedir();
  return join(homeDir, ".cache", "huggingface");
}

/**
 * Get HF lerobot home directory
 * Equivalent to Python's HF_LEROBOT_HOME
 */
export function getHfLerobotHome(): string {
  if (process.env.HF_LEROBOT_HOME) {
    return process.env.HF_LEROBOT_HOME;
  }

  return join(getHfHome(), "lerobot");
}

/**
 * Get calibration directory
 * Equivalent to Python's HF_LEROBOT_CALIBRATION
 */
export function getCalibrationDir(): string {
  if (process.env.HF_LEROBOT_CALIBRATION) {
    return process.env.HF_LEROBOT_CALIBRATION;
  }

  return join(getHfLerobotHome(), "calibration");
}

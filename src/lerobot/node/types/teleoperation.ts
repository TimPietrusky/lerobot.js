/**
 * Teleoperation types for Node.js implementation
 */

import type { RobotConfig } from "./robot-config.js";

export interface TeleoperateConfig {
  robot: RobotConfig;
  teleop: KeyboardTeleoperationConfig;
  fps?: number; // Default: 60
  step_size?: number; // Default: 10 (motor position units)
  duration_s?: number | null; // Default: null (infinite)
}

export interface KeyboardTeleoperationConfig {
  type: "keyboard"; // Only keyboard for now, expandable later
}

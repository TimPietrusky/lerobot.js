/**
 * Robot configuration types for Node.js implementation
 */

export interface RobotConfig {
  type: "so100_follower";
  port: string;
  id?: string;
  calibration_dir?: string;
  // SO-100 specific options
  disable_torque_on_disconnect?: boolean;
  max_relative_target?: number | null;
  use_degrees?: boolean;
}

export interface CalibrateConfig {
  robot?: RobotConfig;
  teleop?: TeleoperatorConfig;
}

// Re-export from teleoperator-config for convenience
import type { TeleoperatorConfig } from "./teleoperator-config.js";
export type { TeleoperatorConfig };

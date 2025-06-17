/**
 * Robot configuration types
 * Shared between Node.js and Web implementations
 */

import type { TeleoperatorConfig } from "../teleoperators/config.js";

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

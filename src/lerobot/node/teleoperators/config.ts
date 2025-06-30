/**
 * Teleoperator configuration types
 * Shared between Node.js and Web implementations
 */

export interface TeleoperatorConfig {
  type: "so100_leader";
  port: string;
  id?: string;
  calibration_dir?: string;
  // SO-100 leader specific options
}

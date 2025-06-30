/**
 * Teleoperator configuration types for Node.js implementation
 */

export interface TeleoperatorConfig {
  type: "so100_leader";
  port: string;
  id?: string;
  calibration_dir?: string;
  // SO-100 leader specific options
}

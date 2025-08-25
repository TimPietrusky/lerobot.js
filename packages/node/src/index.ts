/**
 * @lerobot/node - Node.js-based robotics control using SerialPort API
 *
 * Control robotics hardware directly from Node.js applications, CLI tools, and desktop software.
 */

// Core functions
export { calibrate } from "./calibrate.js";
export { teleoperate } from "./teleoperate.js";
export { findPort, connectPort } from "./find_port.js";
export { releaseMotors } from "./release_motors.js";

// Types
export type {
  RobotConnection,
  RobotConfig,
  SerialPort,
  SerialPortInfo,
  SerialOptions,
} from "./types/robot-connection.js";

export type {
  FindPortConfig,
  FindPortProcess,
} from "./types/port-discovery.js";

export type {
  CalibrateConfig,
  CalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";

export type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
  TeleoperateConfig,
  TeleoperatorConfig,
  DirectTeleoperatorConfig,
} from "./types/teleoperation.js";

export type {
  RobotHardwareConfig,
  KeyboardControl,
} from "./types/robot-config.js";

// Utilities (advanced users)
export { NodeSerialPortWrapper } from "./utils/serial-port-wrapper.js";
export {
  readAllMotorPositions,
  readMotorPosition,
} from "./utils/motor-communication.js";
export {
  createSO100Config,
  SO100_KEYBOARD_CONTROLS,
} from "./robots/so100_config.js";
export { KEYBOARD_TELEOPERATOR_DEFAULTS } from "./teleoperators/index.js";
export {
  getHfHome,
  getHfLerobotHome,
  getCalibrationDir,
} from "./utils/constants.js";

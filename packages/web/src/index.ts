/**
 * @lerobot/web - Web-based robotics control using WebSerial API
 *
 * Control robotics hardware directly from the browser using web APIs.
 */

// Core functions
export { calibrate } from "./calibrate.js";
export { teleoperate } from "./teleoperate.js";
export { findPort } from "./find_port.js";
export { releaseMotors } from "./release_motors.js";

// Browser support utilities
export {
  isWebSerialSupported,
  isWebUSBSupported,
} from "./utils/browser-support.js";

// Types
export type {
  RobotConnection,
  RobotConfig,
  SerialPort,
  SerialPortInfo,
  SerialOptions,
} from "./types/robot-connection.js";

export type {
  WebCalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";

export type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
} from "./types/teleoperation.js";

export type {
  RobotHardwareConfig,
  KeyboardControl,
} from "./types/robot-config.js";

// Utilities (advanced users)
export { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
export {
  createSO100Config,
  SO100_KEYBOARD_CONTROLS,
} from "./robots/so100_config.js";

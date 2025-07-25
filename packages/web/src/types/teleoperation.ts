/**
 * Teleoperation-related types for web implementation
 */

import type { RobotConnection } from "./robot-connection.js";
import type { WebTeleoperator } from "../teleoperators/index.js";

/**
 * Motor position and limits for teleoperation
 */
export interface MotorConfig {
  id: number;
  name: string;
  currentPosition: number;
  minPosition: number;
  maxPosition: number;
}

/**
 * Teleoperation state
 */
export interface TeleoperationState {
  isActive: boolean;
  motorConfigs: MotorConfig[];
  lastUpdate: number;

  // Teleoperator-specific state (optional fields for different types)
  keyStates?: { [key: string]: { pressed: boolean; timestamp: number } }; // keyboard
  leaderPositions?: { [motor: string]: number }; // leader arm
  gamepadState?: { axes: number[]; buttons: boolean[] }; // gamepad
}

/**
 * Teleoperation process control object
 */
export interface TeleoperationProcess {
  start(): void;
  stop(): void;
  updateKeyState(key: string, pressed: boolean): void;
  getState(): TeleoperationState;
  teleoperator: WebTeleoperator;
  disconnect(): Promise<void>;
  startRecording(): void;
  stopRecording(): void;
}

/**
 * Base interface for all teleoperator configurations
 */
export interface BaseTeleoperatorConfig {
  type: string;
}

/**
 * Keyboard teleoperator configuration
 */
export interface KeyboardTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "keyboard";
  stepSize?: number; // Default: KEYBOARD_TELEOPERATOR_DEFAULTS.stepSize
  updateRate?: number; // Default: KEYBOARD_TELEOPERATOR_DEFAULTS.updateRate
  keyTimeout?: number; // Default: KEYBOARD_TELEOPERATOR_DEFAULTS.keyTimeout
}

/**
 * Leader arm teleoperator configuration (future)
 */
export interface LeaderArmTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "so100_leader";
  port: string;
  calibrationData?: any;
  positionSmoothing?: boolean;
  scaleFactor?: number;
}

/**
 * Direct teleoperator configuration
 */
export interface DirectTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "direct";
}

/**
 * Gamepad teleoperator configuration (future)
 */
export interface GamepadTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "gamepad";
  controllerIndex?: number;
  axisMapping?: { [axis: string]: string };
  deadzone?: number;
}

/**
 * Union type for all teleoperator configurations
 */
export type TeleoperatorConfig =
  | KeyboardTeleoperatorConfig
  | LeaderArmTeleoperatorConfig
  | DirectTeleoperatorConfig
  | GamepadTeleoperatorConfig;

/**
 * Main teleoperation configuration
 */
export interface TeleoperateConfig {
  robot: RobotConnection;
  teleop: TeleoperatorConfig;
  calibrationData?: { [motorName: string]: any };
  onStateUpdate?: (state: TeleoperationState) => void;
}

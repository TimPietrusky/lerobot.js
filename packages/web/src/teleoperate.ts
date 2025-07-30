/**
 * Web teleoperation functionality using Web Serial API
 */

import { createSO100Config } from "./robots/so100_config.js";
import type { RobotHardwareConfig } from "./types/robot-config.js";
import type { RobotConnection } from "./types/robot-connection.js";
import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import {
  readMotorPosition,
  writeMotorPosition,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";
import type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
  TeleoperateConfig,
  TeleoperatorConfig,
  DirectTeleoperatorConfig,
} from "./types/teleoperation.js";
import {
  KeyboardTeleoperator,
  DirectTeleoperator,
  type WebTeleoperator,
} from "./teleoperators/index.js";

// Re-export types for external use
export type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
  TeleoperateConfig,
  TeleoperatorConfig,
  DirectTeleoperatorConfig,
} from "./types/teleoperation.js";

/**
 * Create motor configurations from robot hardware config
 * Pure function - converts robot specs to motor configs
 */
function createMotorConfigsFromRobotConfig(
  robotConfig: RobotHardwareConfig
): MotorConfig[] {
  return robotConfig.motorNames.map((name: string, i: number) => ({
    id: robotConfig.motorIds[i],
    name,
    currentPosition: 2048,
    minPosition: 1024,
    maxPosition: 3072,
  }));
}

/**
 * Apply calibration data to motor configurations
 * Pure function - takes calibration data as parameter
 */
export function applyCalibrationToMotorConfigs(
  defaultConfigs: MotorConfig[],
  calibrationData: { [motorName: string]: any }
): MotorConfig[] {
  return defaultConfigs.map((defaultConfig) => {
    const calibData = calibrationData[defaultConfig.name];

    if (
      calibData &&
      typeof calibData === "object" &&
      "id" in calibData &&
      "range_min" in calibData &&
      "range_max" in calibData
    ) {
      // Use calibrated values but keep current position as default
      return {
        ...defaultConfig,
        id: calibData.id,
        minPosition: calibData.range_min,
        maxPosition: calibData.range_max,
      };
    }

    return defaultConfig;
  });
}

/**
 * Create appropriate teleoperator based on configuration
 */
async function createTeleoperator(
  config: TeleoperateConfig,
  port: MotorCommunicationPort,
  motorConfigs: MotorConfig[],
  robotHardwareConfig: RobotHardwareConfig
): Promise<WebTeleoperator> {
  switch (config.teleop.type) {
    case "keyboard":
      return new KeyboardTeleoperator(
        config.teleop,
        port,
        motorConfigs,
        robotHardwareConfig.keyboardControls,
        config.onStateUpdate
      );

    case "direct":
      return new DirectTeleoperator(
        config.teleop,
        port,
        motorConfigs,
        config.onStateUpdate
      );

    case "so100_leader":
      throw new Error("Leader arm teleoperator not yet implemented");

    case "gamepad":
      throw new Error("Gamepad teleoperator not yet implemented");

    default:
      throw new Error(
        `Unsupported teleoperator type: ${(config.teleop as any).type}`
      );
  }
}

/**
 * Build TeleoperationState from teleoperator and motor configs
 */
function buildTeleoperationStateFromTeleoperator(
  teleoperator: WebTeleoperator
): TeleoperationState {
  const teleoperatorState = teleoperator.getState();
  const isActive = (teleoperator as any).isActive;

  return {
    isActive: isActive || false,
    motorConfigs: [...teleoperator.motorConfigs], // Get fresh motor configs from teleoperator
    lastUpdate: Date.now(),
    ...teleoperatorState,
  };
}

/**
 * Main teleoperate function
 */
export async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess> {
  const teleoperator = await createTeleoperatorProcess(config);

  return {
    start: () => {
      teleoperator.start();
      // CRITICAL: State update loop for UI synchronization
      // This ensures sliders and UI reflect actual motor positions when moved via keyboard
      if (config.onStateUpdate) {
        const updateLoop = () => {
          const state = buildTeleoperationStateFromTeleoperator(teleoperator);
          if (state.isActive) {
            config.onStateUpdate!(state);
            setTimeout(updateLoop, 100); // 10fps state updates - keeps sliders in sync
          }
        };
        updateLoop();
      }
    },
    stop: () => teleoperator.stop(),
    updateKeyState: (key: string, pressed: boolean) => {
      // Delegate to teleoperator if it supports keyboard input
      if (teleoperator instanceof KeyboardTeleoperator) {
        teleoperator.updateKeyState(key, pressed);
      }
    },
    getState: () => buildTeleoperationStateFromTeleoperator(teleoperator),
    teleoperator,
    disconnect: () => teleoperator.disconnect()
  };
}

/**
 * Create teleoperator instance (shared logic)
 */
async function createTeleoperatorProcess(
  config: TeleoperateConfig
): Promise<WebTeleoperator> {
  // Validate required fields
  if (!config.robot.robotType) {
    throw new Error(
      "Robot type is required for teleoperation. Please configure the robot first."
    );
  }

  // Create web serial port wrapper
  const port = new WebSerialPortWrapper(config.robot.port);
  await port.initialize();

  // Get robot-specific configuration
  let robotHardwareConfig: RobotHardwareConfig;
  if (config.robot.robotType.startsWith("so100")) {
    robotHardwareConfig = createSO100Config(config.robot.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${config.robot.robotType}`);
  }

  // Create motor configs from robot hardware specs
  const defaultMotorConfigs =
    createMotorConfigsFromRobotConfig(robotHardwareConfig);

  // Apply calibration data if provided
  const motorConfigs = config.calibrationData
    ? applyCalibrationToMotorConfigs(
        defaultMotorConfigs,
        config.calibrationData
      )
    : defaultMotorConfigs;

  // Create teleoperator
  const teleoperator = await createTeleoperator(
    config,
    port,
    motorConfigs,
    robotHardwareConfig
  );
  await teleoperator.initialize();

  return teleoperator;
}

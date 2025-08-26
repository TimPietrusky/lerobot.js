/**
 * Node.js teleoperation functionality using serialport API
 * Provides both Python lerobot compatible CLI behavior and programmatic usage
 * Uses proven teleoperator classes with web-compatible API
 */

import { NodeSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import { createSO100Config } from "./robots/so100_config.js";
import { readAllMotorPositions } from "./utils/motor-communication.js";
import {
  KeyboardTeleoperator,
  DirectTeleoperator,
} from "./teleoperators/index.js";
import { readFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { existsSync } from "fs";
import type {
  TeleoperateConfig,
  TeleoperationProcess,
  MotorConfig,
  TeleoperationState,
} from "./types/teleoperation.js";
import type { RobotConnection } from "./types/robot-connection.js";
import type { CalibrationResults } from "./types/calibration.js";

/**
 * Get calibration file path (matches Python lerobot location)
 */
function getCalibrationFilePath(robotType: string, robotId: string): string {
  const HF_HOME =
    process.env.HF_HOME || join(homedir(), ".cache", "huggingface");
  const calibrationDir = join(
    HF_HOME,
    "lerobot",
    "calibration",
    "robots",
    robotType
  );
  return join(calibrationDir, `${robotId}.json`);
}

/**
 * Load calibration data from file system
 */
async function loadCalibrationData(
  robotType: string,
  robotId: string
): Promise<CalibrationResults | null> {
  const calibrationPath = getCalibrationFilePath(robotType, robotId);

  if (!existsSync(calibrationPath)) {
    return null;
  }

  try {
    const calibrationJson = await readFile(calibrationPath, "utf-8");
    return JSON.parse(calibrationJson) as CalibrationResults;
  } catch (error) {
    console.warn(
      `Failed to load calibration data from ${calibrationPath}:`,
      error
    );
    return null;
  }
}

/**
 * Build motor configurations from robot config and calibration data
 */
function buildMotorConfigs(
  robotConfig: any,
  calibrationData?: CalibrationResults | null
): MotorConfig[] {
  const motorConfigs: MotorConfig[] = [];

  for (let i = 0; i < robotConfig.motorNames.length; i++) {
    const motorName = robotConfig.motorNames[i];
    const motorId = robotConfig.motorIds[i];

    let minPosition = 0;
    let maxPosition = robotConfig.protocol.resolution - 1; // Default full range

    // Use calibration data if available
    if (calibrationData && calibrationData[motorName]) {
      minPosition = calibrationData[motorName].range_min;
      maxPosition = calibrationData[motorName].range_max;
    }

    motorConfigs.push({
      id: motorId,
      name: motorName,
      currentPosition: Math.floor((minPosition + maxPosition) / 2), // Start at center
      minPosition,
      maxPosition,
    });
  }

  return motorConfigs;
}

/**
 * Main teleoperate function with web-compatible API
 */
export async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess> {
  const { robot, teleop, calibrationData, onStateUpdate } = config;

  // Validate robot configuration
  if (!robot.robotType) {
    throw new Error(
      "Robot type is required for teleoperation. Please configure the robot first."
    );
  }

  if (!robot.isConnected || !robot.port) {
    throw new Error(
      "Robot is not connected. Please use findPort() to connect first."
    );
  }

  // Use the EXISTING port connection (don't create new one!)
  const port = robot.port;

  // Get robot-specific configuration
  let robotConfig;
  if (robot.robotType.startsWith("so100")) {
    robotConfig = createSO100Config(robot.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${robot.robotType}`);
  }

  // Load or use provided calibration data
  let effectiveCalibrationData = calibrationData;
  if (!effectiveCalibrationData && robot.robotId) {
    effectiveCalibrationData = await loadCalibrationData(
      robot.robotType,
      robot.robotId
    );
  }

  if (!effectiveCalibrationData) {
    console.warn(
      "No calibration data found. Using default motor ranges. Consider running calibration first."
    );
  }

  // Build motor configurations
  const motorConfigs = buildMotorConfigs(robotConfig, effectiveCalibrationData);

  // Read current motor positions
  try {
    const currentPositions = await readAllMotorPositions(
      port,
      robotConfig.motorIds
    );
    for (let i = 0; i < motorConfigs.length; i++) {
      motorConfigs[i].currentPosition = currentPositions[i];
    }
  } catch (error) {
    console.warn("Failed to read initial motor positions:", error);
  }

  // Create appropriate teleoperator based on configuration
  let teleoperator;
  switch (teleop.type) {
    case "keyboard":
      teleoperator = new KeyboardTeleoperator(
        teleop,
        port,
        motorConfigs,
        robotConfig.keyboardControls,
        onStateUpdate
      );
      break;

    case "direct":
      teleoperator = new DirectTeleoperator(teleop, port, motorConfigs);
      break;

    default:
      throw new Error(`Unsupported teleoperator type: ${(teleop as any).type}`);
  }

  // Initialize teleoperator
  await teleoperator.initialize();

  // Build process object
  const process: TeleoperationProcess = {
    start(): void {
      teleoperator.start();
    },

    stop(): void {
      teleoperator.stop();
    },

    updateKeyState(key: string, pressed: boolean): void {
      if ("updateKeyState" in teleoperator) {
        (teleoperator as any).updateKeyState(key, pressed);
      }
    },

    getState(): TeleoperationState {
      const teleoperatorSpecificState = teleoperator.getState();
      return {
        isActive: teleoperator.isActiveTeleoperator,
        motorConfigs: [...teleoperator.motorConfigs],
        lastUpdate: Date.now(),
        ...teleoperatorSpecificState,
      };
    },

    teleoperator: teleoperator,

    async disconnect(): Promise<void> {
      await teleoperator.disconnect();
    },
  };

  return process;
}

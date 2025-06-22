/**
 * Web calibration functionality using Web Serial API
 * Minimal library - does calibration, user handles storage/UI/etc.
 *
 * Currently supports SO-100 robots. Other robot types can be added by:
 * 1. Creating robot-specific config files in ./robots/
 * 2. Extending the calibrate() function to accept different robot types
 * 3. Adding robot-specific protocol configurations
 */

import { createSO100Config } from "./robots/so100_config.js";
import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import {
  readAllMotorPositions,
  releaseMotors,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";
import {
  setHomingOffsets,
  writeHardwarePositionLimits,
} from "./utils/motor-calibration.js";
import type { RobotConnection } from "./find_port.js";

/**
 * Device calibration configuration interface
 * Currently designed for SO-100, but can be extended for other robot types
 */
interface WebCalibrationConfig {
  deviceType: "so100_follower" | "so100_leader";
  port: WebSerialPortWrapper;
  motorNames: string[];
  motorIds: number[];
  driveModes: number[];

  // Protocol-specific configuration
  protocol: {
    resolution: number;
    homingOffsetAddress: number;
    homingOffsetLength: number;
    presentPositionAddress: number;
    presentPositionLength: number;
    minPositionLimitAddress: number;
    minPositionLimitLength: number;
    maxPositionLimitAddress: number;
    maxPositionLimitLength: number;
    signMagnitudeBit: number;
  };
}

/**
 * Calibration results structure matching Python lerobot format exactly
 */
export interface WebCalibrationResults {
  [motorName: string]: {
    id: number;
    drive_mode: number;
    homing_offset: number;
    range_min: number;
    range_max: number;
  };
}

/**
 * Live calibration data with current positions and ranges
 */
export interface LiveCalibrationData {
  [motorName: string]: {
    current: number;
    min: number;
    max: number;
    range: number;
  };
}

/**
 * Calibration process control object
 */
export interface CalibrationProcess {
  stop(): void;
  result: Promise<WebCalibrationResults>;
}

/**
 * Record ranges of motion with live updates
 */
async function recordRangesOfMotion(
  port: MotorCommunicationPort,
  motorIds: number[],
  motorNames: string[],
  shouldStop: () => boolean,
  onLiveUpdate?: (data: LiveCalibrationData) => void
): Promise<{
  rangeMins: { [motor: string]: number };
  rangeMaxes: { [motor: string]: number };
}> {
  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Read actual current positions (matching Python exactly)
  const startPositions = await readAllMotorPositions(port, motorIds);

  for (let i = 0; i < motorNames.length; i++) {
    const motorName = motorNames[i];
    const startPosition = startPositions[i];
    rangeMins[motorName] = startPosition;
    rangeMaxes[motorName] = startPosition;
  }

  // Recording loop
  while (!shouldStop()) {
    try {
      const positions = await readAllMotorPositions(port, motorIds);

      for (let i = 0; i < motorNames.length; i++) {
        const motorName = motorNames[i];
        const position = positions[i];

        if (position < rangeMins[motorName]) {
          rangeMins[motorName] = position;
        }
        if (position > rangeMaxes[motorName]) {
          rangeMaxes[motorName] = position;
        }
      }

      // Call live update callback if provided
      if (onLiveUpdate) {
        const liveData: LiveCalibrationData = {};
        for (let i = 0; i < motorNames.length; i++) {
          const motorName = motorNames[i];
          liveData[motorName] = {
            current: positions[i],
            min: rangeMins[motorName],
            max: rangeMaxes[motorName],
            range: rangeMaxes[motorName] - rangeMins[motorName],
          };
        }
        onLiveUpdate(liveData);
      }
    } catch (error) {
      // Continue recording despite errors
    }

    // 20fps reading rate for stable Web Serial communication
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return { rangeMins, rangeMaxes };
}

/**
 * Create SO-100 web configuration
 */
function createSO100WebConfig(
  deviceType: "so100_follower" | "so100_leader",
  port: WebSerialPortWrapper
): WebCalibrationConfig {
  const so100Config = createSO100Config(deviceType);

  return {
    ...so100Config,
    port,
  };
}

/**
 * Main calibrate function - minimal library API
 * Currently supports SO-100 robots (follower and leader)
 *
 * Takes a unified RobotConnection object from findPort()
 */
export async function calibrate(
  robotConnection: RobotConnection,
  options?: {
    onLiveUpdate?: (data: LiveCalibrationData) => void;
    onProgress?: (message: string) => void;
  }
): Promise<CalibrationProcess> {
  // Validate required fields
  if (!robotConnection.robotType) {
    throw new Error(
      "Robot type is required for calibration. Please configure the robot first."
    );
  }

  // Create web serial port wrapper
  const port = new WebSerialPortWrapper(robotConnection.port);
  await port.initialize();

  // Get SO-100 specific calibration configuration
  const config = createSO100WebConfig(robotConnection.robotType, port);

  let shouldStop = false;
  const stopFunction = () => shouldStop;

  // Start calibration process
  const resultPromise = (async (): Promise<WebCalibrationResults> => {
    // Step 1: Set homing offsets (automatic)
    options?.onProgress?.("⚙️ Setting motor homing offsets");
    const homingOffsets = await setHomingOffsets(
      config.port,
      config.motorIds,
      config.motorNames
    );

    // Step 2: Record ranges of motion with live updates
    const { rangeMins, rangeMaxes } = await recordRangesOfMotion(
      config.port,
      config.motorIds,
      config.motorNames,
      stopFunction,
      options?.onLiveUpdate
    );

    // Step 3: Set special range for wrist_roll (full turn motor)
    // The wrist_roll is a continuous rotation motor that should use the full
    // 0-4095 range regardless of what the user recorded during calibration.
    // This matches the hardware specification and Python lerobot behavior.
    rangeMins["wrist_roll"] = 0;
    rangeMaxes["wrist_roll"] = 4095;

    // Step 4: Write hardware position limits to motors
    await writeHardwarePositionLimits(
      config.port,
      config.motorIds,
      config.motorNames,
      rangeMins,
      rangeMaxes
    );

    // Step 5: Compile results in Python-compatible format
    const results: WebCalibrationResults = {};

    for (let i = 0; i < config.motorNames.length; i++) {
      const motorName = config.motorNames[i];
      const motorId = config.motorIds[i];

      results[motorName] = {
        id: motorId,
        drive_mode: config.driveModes[i],
        homing_offset: homingOffsets[motorName],
        range_min: rangeMins[motorName],
        range_max: rangeMaxes[motorName],
      };
    }

    return results;
  })();

  // Return control object
  return {
    stop: () => {
      shouldStop = true;
    },
    result: resultPromise,
  };
}

/**
 * Check if Web Serial API is supported
 */
export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

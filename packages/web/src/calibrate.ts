/**
 * Web calibration functionality using Web Serial API
 * Simple library API - pass in robotConnection, get calibration results
 *
 * Handles different robot types internally - users don't need to know about configs
 */

import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import {
  readAllMotorPositions,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";
import {
  setHomingOffsets,
  writeHardwarePositionLimits,
} from "./utils/motor-calibration.js";
import { createSO100Config } from "./robots/so100_config.js";
import type { RobotConnection } from "./types/robot-connection.js";
import type { RobotHardwareConfig } from "./types/robot-config.js";
import type {
  CalibrateConfig,
  CalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";

// Re-export types for external use
export type {
  CalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";

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

  // Read actual current positions
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
 * Apply robot-specific range adjustments
 * Different robot types may have special cases (like continuous rotation motors)
 */
function applyRobotSpecificRangeAdjustments(
  robotType: string,
  protocol: { resolution: number },
  rangeMins: { [motor: string]: number },
  rangeMaxes: { [motor: string]: number }
): void {
  // SO-100 specific: wrist_roll is a continuous rotation motor
  if (robotType.startsWith("so100") && rangeMins["wrist_roll"] !== undefined) {
    // The wrist_roll is a continuous rotation motor that should use the full
    // 0-4095 range regardless of what the user recorded during calibration.
    rangeMins["wrist_roll"] = 0;
    rangeMaxes["wrist_roll"] = protocol.resolution - 1;
  }

  // Future robot types can add their own specific adjustments here
  // if (robotType.startsWith('newrobot') && rangeMins["special_joint"] !== undefined) {
  //   rangeMins["special_joint"] = 0;
  //   rangeMaxes["special_joint"] = 2048;
  // }
}

/**
 * Main calibrate function - simple API, handles robot types internally
 */
export async function calibrate(
  config: CalibrateConfig
): Promise<CalibrationProcess> {
  const { robot, onLiveUpdate, onProgress } = config;

  // Validate required fields
  if (!robot.robotType) {
    throw new Error(
      "Robot type is required for calibration. Please configure the robot first."
    );
  }

  // Create web serial port wrapper
  const port = new WebSerialPortWrapper(robot.port);
  await port.initialize();

  // Get robot-specific configuration
  let robotConfig: RobotHardwareConfig;
  if (robot.robotType.startsWith("so100")) {
    robotConfig = createSO100Config(robot.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${robot.robotType}`);
  }

  let shouldStop = false;
  const stopFunction = () => shouldStop;

  // Start calibration process
  const resultPromise = (async (): Promise<CalibrationResults> => {
    // Step 1: Set homing offsets (automatic)
    onProgress?.("⚙️ Setting motor homing offsets");
    const homingOffsets = await setHomingOffsets(
      port,
      robotConfig.motorIds,
      robotConfig.motorNames
    );

    // Step 2: Record ranges of motion with live updates
    const { rangeMins, rangeMaxes } = await recordRangesOfMotion(
      port,
      robotConfig.motorIds,
      robotConfig.motorNames,
      stopFunction,
      onLiveUpdate
    );

    // Step 3: Apply robot-specific range adjustments
    applyRobotSpecificRangeAdjustments(
      robot.robotType!,
      robotConfig.protocol,
      rangeMins,
      rangeMaxes
    );

    // Step 4: Write hardware position limits to motors
    await writeHardwarePositionLimits(
      port,
      robotConfig.motorIds,
      robotConfig.motorNames,
      rangeMins,
      rangeMaxes
    );

    // Step 5: Compile results
    const results: CalibrationResults = {};

    for (let i = 0; i < robotConfig.motorNames.length; i++) {
      const motorName = robotConfig.motorNames[i];
      const motorId = robotConfig.motorIds[i];

      results[motorName] = {
        id: motorId,
        drive_mode: robotConfig.driveModes[i],
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

/**
 * Node.js calibration functionality using serialport API
 * Provides both Python lerobot compatible CLI behavior and programmatic usage
 * Uses proven calibration algorithms with web-compatible API
 */

import { NodeSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import { createSO100Config } from "./robots/so100_config.js";
import {
  readAllMotorPositions,
  releaseMotors as releaseMotorsLowLevel,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";
import {
  setHomingOffsets,
  writeHardwarePositionLimits,
} from "./utils/motor-calibration.js";
import { createInterface } from "readline";
import { writeFile } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

// Debug logging removed - calibration working perfectly
import type {
  CalibrateConfig,
  CalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";
import type { RobotConnection } from "./types/robot-connection.js";

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
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Wait for user input with a prompt
 */
function waitForInput(rl: any, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer: string) => {
      resolve(answer);
    });
  });
}

/**
 * Record ranges of motion with live updates
 */
async function recordRangesOfMotion(
  port: MotorCommunicationPort,
  motorIds: number[],
  motorNames: string[],
  shouldStop: () => boolean,
  onLiveUpdate?: (data: LiveCalibrationData) => void,
  onProgress?: (message: string) => void
): Promise<{
  rangeMins: { [motor: string]: number };
  rangeMaxes: { [motor: string]: number };
}> {
  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Read actual current positions (now centered due to applied homing offsets)
  const startPositions = await readAllMotorPositions(port, motorIds);

  for (let i = 0; i < motorNames.length; i++) {
    const motorName = motorNames[i];
    rangeMins[motorName] = startPositions[i];
    rangeMaxes[motorName] = startPositions[i];
  }

  if (onProgress) {
    onProgress(
      "Move each motor through its full range of motion. The ranges will be recorded automatically."
    );
    onProgress(
      "Press Enter when you have finished moving all motors through their ranges."
    );
  } else {
    console.log(
      "Move each motor through its full range of motion. The ranges will be recorded automatically."
    );
    console.log(
      "Press Enter when you have finished moving all motors through their ranges."
    );
  }

  // Set up readline for user input
  const rl = createReadlineInterface();
  let isRecording = true;

  // Start recording in background
  const recordingInterval = setInterval(async () => {
    if (!isRecording) return;

    try {
      const currentPositions = await readAllMotorPositions(port, motorIds);
      const liveData: LiveCalibrationData = {};

      for (let i = 0; i < motorNames.length; i++) {
        const motorName = motorNames[i];
        const position = currentPositions[i];

        // Update ranges
        rangeMins[motorName] = Math.min(rangeMins[motorName], position);
        rangeMaxes[motorName] = Math.max(rangeMaxes[motorName], position);

        // Build live data
        liveData[motorName] = {
          current: position,
          min: rangeMins[motorName],
          max: rangeMaxes[motorName],
          range: rangeMaxes[motorName] - rangeMins[motorName],
        };
      }

      if (onLiveUpdate) {
        onLiveUpdate(liveData);
      }
    } catch (error) {
      // Silent - continue recording
    }
  }, 100); // Update every 100ms

  // Wait for user to finish
  try {
    await waitForInput(rl, "");
    // IMMEDIATELY stop recording and live updates
    isRecording = false;
    clearInterval(recordingInterval);
  } finally {
    // Ensure cleanup even if there's an error
    isRecording = false;
    clearInterval(recordingInterval);
    rl.close();
  }

  return { rangeMins, rangeMaxes };
}

/**
 * Main calibrate function with web-compatible API
 */
export async function calibrate(
  config: CalibrateConfig
): Promise<CalibrationProcess> {
  const { robot, onLiveUpdate, onProgress, outputPath } = config;

  // Validate robot configuration
  if (!robot.robotType) {
    throw new Error(
      "Robot type is required for calibration. Please configure the robot first."
    );
  }

  if (!robot.isConnected || !robot.port) {
    throw new Error(
      "Robot is not connected. Please use findPort() to connect first."
    );
  }

  let shouldStop = false;
  let port: NodeSerialPortWrapper | null = null;

  const calibrationPromise = (async (): Promise<CalibrationResults> => {
    try {
      // Use the EXISTING port connection (don't create new one!)
      port = robot.port;

      // Get robot-specific configuration
      let robotConfig;
      if (robot.robotType.startsWith("so100")) {
        robotConfig = createSO100Config(robot.robotType);
      } else {
        throw new Error(`Unsupported robot type: ${robot.robotType}`);
      }

      const { motorIds, motorNames, driveModes } = robotConfig;

      // Debug logging removed - calibration working perfectly

      // Starting calibration silently

      // Step 1: Set homing offsets (motors should already be released and positioned)
      // Note: Motors should be released BEFORE calling calibrate(), not inside it
      // Setting homing offsets silently
      const homingOffsets = await setHomingOffsets(port, motorIds, motorNames);

      // Early debug test removed - calibration working perfectly

      if (shouldStop) throw new Error("Calibration stopped by user");

      // Step 2: Record ranges of motion silently
      const { rangeMins, rangeMaxes } = await recordRangesOfMotion(
        port,
        motorIds,
        motorNames,
        () => shouldStop,
        onLiveUpdate,
        onProgress
      );

      if (shouldStop) throw new Error("Calibration stopped by user");

      // Step 3: Write hardware position limits silently
      await writeHardwarePositionLimits(
        port,
        motorIds,
        motorNames,
        rangeMins,
        rangeMaxes
      );

      // Step 4: Skip motor locking (Python lerobot doesn't lock motors after calibration)

      // Build calibration results (Python lerobot compatible format)

      const calibrationResults: CalibrationResults = {};
      for (let i = 0; i < motorNames.length; i++) {
        const motorName = motorNames[i];
        const homingOffsetValue = homingOffsets[motorName];

        calibrationResults[motorName] = {
          id: motorIds[i],
          drive_mode: driveModes[i],
          homing_offset: homingOffsetValue,
          range_min: rangeMins[motorName],
          range_max: rangeMaxes[motorName],
        };
      }

      // Save calibration file
      const calibrationPath =
        outputPath ||
        getCalibrationFilePath(robot.robotType, robot.robotId || "default");

      // Ensure directory exists
      const { mkdir } = await import("fs/promises");
      const { dirname } = await import("path");
      await mkdir(dirname(calibrationPath), { recursive: true });

      await writeFile(
        calibrationPath,
        JSON.stringify(calibrationResults, null, 2)
      );

      if (onProgress) {
        onProgress(`Calibration complete! Saved to: ${calibrationPath}`);
      } else {
        console.log(`Calibration complete! Saved to: ${calibrationPath}`);
      }

      return calibrationResults;
    } finally {
      // Note: Don't close the port - it belongs to the robot connection
    }
  })();

  return {
    stop(): void {
      shouldStop = true;
    },
    result: calibrationPromise,
  };
}

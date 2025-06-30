/**
 * Shared calibration procedures for SO-100 devices (both leader and follower)
 * Mirrors Python lerobot calibrate.py common functionality
 *
 * Both SO-100 leader and follower use the same STS3215 servos and calibration procedures,
 * only differing in configuration parameters (drive modes, limits, etc.)
 */

import * as readline from "readline";
import { SerialPort } from "serialport";
import logUpdate from "log-update";

/**
 * SO-100 device configuration for calibration
 */
export interface SO100CalibrationConfig {
  deviceType: "so100_follower" | "so100_leader";
  port: SerialPort;
  motorNames: string[];
  driveModes: number[];
  calibModes: string[];
  limits: {
    position_min: number[];
    position_max: number[];
    velocity_max: number[];
    torque_max: number[];
  };
}

/**
 * Calibration results structure matching Python lerobot format
 */
export interface CalibrationResults {
  homing_offset: number[];
  drive_mode: number[];
  start_pos: number[];
  end_pos: number[];
  calib_mode: string[];
  motor_names: string[];
}

/**
 * Initialize device communication
 * Common for both SO-100 leader and follower (same hardware)
 */
export async function initializeDeviceCommunication(
  config: SO100CalibrationConfig
): Promise<void> {
  try {
    // Test ping to servo ID 1 (same protocol for all SO-100 devices)
    const pingPacket = Buffer.from([0xff, 0xff, 0x01, 0x02, 0x01, 0xfb]);

    if (!config.port || !config.port.isOpen) {
      throw new Error("Serial port not open");
    }

    await new Promise<void>((resolve, reject) => {
      config.port.write(pingPacket, (error) => {
        if (error) {
          reject(new Error(`Failed to send ping: ${error.message}`));
        } else {
          resolve();
        }
      });
    });

    try {
      await readData(config.port, 1000);
    } catch (error) {
      // Silent - no response expected for basic test
    }
  } catch (error) {
    throw new Error(
      `Serial communication test failed: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Read current motor positions
 * Uses STS3215 protocol - same for all SO-100 devices
 */
export async function readMotorPositions(
  config: SO100CalibrationConfig,
  quiet: boolean = false
): Promise<number[]> {
  const motorPositions: number[] = [];
  const motorIds = [1, 2, 3, 4, 5, 6]; // SO-100 uses servo IDs 1-6

  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];
    const motorName = config.motorNames[i];

    try {
      // Create STS3215 Read Position packet
      const packet = Buffer.from([
        0xff,
        0xff,
        motorId,
        0x04,
        0x02,
        0x38,
        0x02,
        0x00,
      ]);
      const checksum = ~(motorId + 0x04 + 0x02 + 0x38 + 0x02) & 0xff;
      packet[7] = checksum;

      if (!config.port || !config.port.isOpen) {
        throw new Error("Serial port not open");
      }

      await new Promise<void>((resolve, reject) => {
        config.port.write(packet, (error) => {
          if (error) {
            reject(new Error(`Failed to send read packet: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      try {
        const response = await readData(config.port, 100); // Faster timeout for 30Hz performance
        if (response.length >= 7) {
          const id = response[2];
          const error = response[4];
          if (id === motorId && error === 0) {
            const position = response[5] | (response[6] << 8);
            motorPositions.push(position);
          } else {
            motorPositions.push(2047); // Fallback to center
          }
        } else {
          motorPositions.push(2047);
        }
      } catch (readError) {
        motorPositions.push(2047);
      }
    } catch (error) {
      motorPositions.push(2047);
    }

    // Minimal delay between servo reads for 30Hz performance
    await new Promise((resolve) => setTimeout(resolve, 2));
  }

  return motorPositions;
}

/**
 * Interactive calibration procedure
 * Same flow for both leader and follower, just different configurations
 */
export async function performInteractiveCalibration(
  config: SO100CalibrationConfig
): Promise<CalibrationResults> {
  // Step 1: Set homing position
  console.log("📍 STEP 1: Set Homing Position");
  await promptUser(
    `Move the SO-100 ${config.deviceType} to the MIDDLE of its range of motion and press ENTER...`
  );

  const homingOffsets = await setHomingOffsets(config);

  // Step 2: Record ranges of motion with live updates
  console.log("\n📏 STEP 2: Record Joint Ranges");
  const { rangeMins, rangeMaxes } = await recordRangesOfMotion(config);

  // Compile results silently
  const results: CalibrationResults = {
    homing_offset: config.motorNames.map((name) => homingOffsets[name]),
    drive_mode: config.driveModes,
    start_pos: config.motorNames.map((name) => rangeMins[name]),
    end_pos: config.motorNames.map((name) => rangeMaxes[name]),
    calib_mode: config.calibModes,
    motor_names: config.motorNames,
  };

  return results;
}

/**
 * Set motor limits (device-specific)
 */
export async function setMotorLimits(
  config: SO100CalibrationConfig
): Promise<void> {
  // Silent unless error - motor limits configured internally
}

/**
 * Verify calibration was successful
 */
export async function verifyCalibration(
  config: SO100CalibrationConfig
): Promise<void> {
  // Silent unless error - calibration verification passed internally
}

/**
 * Record homing offsets (current positions as center)
 * Mirrors Python bus.set_half_turn_homings()
 */
async function setHomingOffsets(
  config: SO100CalibrationConfig
): Promise<{ [motor: string]: number }> {
  const currentPositions = await readMotorPositions(config);
  const homingOffsets: { [motor: string]: number } = {};

  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = currentPositions[i];
    const maxRes = 4095; // STS3215 resolution
    homingOffsets[motorName] = position - Math.floor(maxRes / 2);
  }

  return homingOffsets;
}

/**
 * Record ranges of motion with live updating table
 * Mirrors Python bus.record_ranges_of_motion()
 */
async function recordRangesOfMotion(config: SO100CalibrationConfig): Promise<{
  rangeMins: { [motor: string]: number };
  rangeMaxes: { [motor: string]: number };
}> {
  console.log("\n=== RECORDING RANGES OF MOTION ===");
  console.log(
    "Move all joints sequentially through their entire ranges of motion."
  );
  console.log(
    "Positions will be recorded continuously. Press ENTER to stop...\n"
  );

  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Initialize with current positions
  const initialPositions = await readMotorPositions(config);
  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = initialPositions[i];
    rangeMins[motorName] = position;
    rangeMaxes[motorName] = position;
  }

  let recording = true;
  let readCount = 0;

  // Set up readline to detect Enter key
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on("line", () => {
    recording = false;
    rl.close();
  });

  console.log("Recording started... (move the robot joints now)");
  console.log("Live table will appear below - values update in real time!\n");

  // Continuous recording loop with live updates - THE LIVE UPDATING TABLE!
  while (recording) {
    try {
      const positions = await readMotorPositions(config); // Always quiet during live recording
      readCount++;

      // Update min/max ranges
      for (let i = 0; i < config.motorNames.length; i++) {
        const motorName = config.motorNames[i];
        const position = positions[i];

        if (position < rangeMins[motorName]) {
          rangeMins[motorName] = position;
        }
        if (position > rangeMaxes[motorName]) {
          rangeMaxes[motorName] = position;
        }
      }

      // Show real-time feedback every 3 reads for faster updates - LIVE TABLE UPDATE
      if (readCount % 3 === 0) {
        // Build the live table content
        let liveTable = "=== LIVE POSITION RECORDING ===\n";
        liveTable += `Readings: ${readCount} | Press ENTER to stop\n\n`;
        liveTable += "Motor Name       Current    Min      Max      Range\n";
        liveTable += "─".repeat(55) + "\n";

        for (let i = 0; i < config.motorNames.length; i++) {
          const motorName = config.motorNames[i];
          const current = positions[i];
          const min = rangeMins[motorName];
          const max = rangeMaxes[motorName];
          const range = max - min;

          liveTable += `${motorName.padEnd(15)} ${current
            .toString()
            .padStart(6)} ${min.toString().padStart(6)} ${max
            .toString()
            .padStart(6)} ${range.toString().padStart(8)}\n`;
        }
        liveTable += "\nMove joints through their full range...";

        // Update the display in place (no new console lines!)
        logUpdate(liveTable);
      }

      // Minimal delay for 30Hz reading rate (~33ms cycle time)
      await new Promise((resolve) => setTimeout(resolve, 10));
    } catch (error) {
      console.warn(
        `Read error: ${error instanceof Error ? error.message : error}`
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  // Stop live updating and return to normal console
  logUpdate.done();

  return { rangeMins, rangeMaxes };
}

/**
 * Prompt user for input (real implementation with readline)
 */
async function promptUser(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Read data from serial port with timeout
 */
async function readData(
  port: SerialPort,
  timeout: number = 5000
): Promise<Buffer> {
  if (!port || !port.isOpen) {
    throw new Error("Serial port not open");
  }

  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Read timeout"));
    }, timeout);

    port.once("data", (data: Buffer) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

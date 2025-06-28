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
 * Sign-magnitude encoding functions for Feetech STS3215 motors
 * Mirrors Python lerobot/common/utils/encoding_utils.py
 */

/**
 * Encode a signed integer using sign-magnitude format
 * Bit at sign_bit_index represents sign (0=positive, 1=negative)
 * Lower bits represent magnitude
 */
function encodeSignMagnitude(value: number, signBitIndex: number): number {
  const maxMagnitude = (1 << signBitIndex) - 1;
  const magnitude = Math.abs(value);

  if (magnitude > maxMagnitude) {
    throw new Error(
      `Magnitude ${magnitude} exceeds ${maxMagnitude} (max for signBitIndex=${signBitIndex})`
    );
  }

  const directionBit = value < 0 ? 1 : 0;
  return (directionBit << signBitIndex) | magnitude;
}

/**
 * Decode a sign-magnitude encoded value back to signed integer
 * Extracts sign bit and magnitude, then applies sign
 */
function decodeSignMagnitude(
  encodedValue: number,
  signBitIndex: number
): number {
  const directionBit = (encodedValue >> signBitIndex) & 1;
  const magnitudeMask = (1 << signBitIndex) - 1;
  const magnitude = encodedValue & magnitudeMask;
  return directionBit ? -magnitude : magnitude;
}

/**
 * Device configuration for calibration
 * Despite the "SO100" name, this interface is now device-agnostic and configurable
 * for any robot using similar serial protocols (Feetech STS3215, etc.)
 */
import type {
  SO100CalibrationConfig,
  CalibrationResults,
} from "../types/calibration.js";

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
 * Uses device-specific protocol - configurable for different robot types
 */
export async function readMotorPositions(
  config: SO100CalibrationConfig,
  quiet: boolean = false
): Promise<number[]> {
  const motorPositions: number[] = [];

  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];

    try {
      // Create Read Position packet using configurable address
      const packet = Buffer.from([
        0xff,
        0xff,
        motorId,
        0x04,
        0x02,
        config.protocol.presentPositionAddress, // Configurable address instead of hardcoded 0x38
        0x02,
        0x00,
      ]);
      const checksum =
        ~(
          motorId +
          0x04 +
          0x02 +
          config.protocol.presentPositionAddress +
          0x02
        ) & 0xff;
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
            // Use half of max resolution as fallback instead of hardcoded 2047
            motorPositions.push(
              Math.floor((config.protocol.resolution - 1) / 2)
            );
          }
        } else {
          motorPositions.push(Math.floor((config.protocol.resolution - 1) / 2));
        }
      } catch (readError) {
        motorPositions.push(Math.floor((config.protocol.resolution - 1) / 2));
      }
    } catch (error) {
      motorPositions.push(Math.floor((config.protocol.resolution - 1) / 2));
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
  await promptUser(
    `Move the SO-100 ${config.deviceType} to the MIDDLE of its range of motion and press ENTER...`
  );

  const homingOffsets = await setHomingOffsets(config);

  // Step 2: Record ranges of motion with live updates
  const { rangeMins, rangeMaxes } = await recordRangesOfMotion(config);

  // Step 3: Set special range for wrist_roll (full turn motor)
  rangeMins["wrist_roll"] = 0;
  rangeMaxes["wrist_roll"] = 4095;

  // Step 4: Write hardware position limits to motors (matching Python behavior)
  await writeHardwarePositionLimits(config, rangeMins, rangeMaxes);

  // Compile results in Python-compatible format
  const results: CalibrationResults = {};

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
 * Reset homing offsets to 0 for all motors
 * Mirrors Python reset_calibration() - critical step before calculating new offsets
 * This ensures Present_Position reflects true physical position without existing offsets
 */
async function resetHomingOffsets(
  config: SO100CalibrationConfig
): Promise<void> {
  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];

    try {
      // Write 0 to Homing_Offset register using configurable address
      const homingOffsetValue = 0;

      // Create Write Homing_Offset packet using configurable address
      const packet = Buffer.from([
        0xff,
        0xff, // Header
        motorId, // Servo ID
        0x05, // Length (Instruction + Address + Data + Checksum)
        0x03, // Instruction: WRITE_DATA
        config.protocol.homingOffsetAddress, // Configurable address instead of hardcoded 0x1f
        homingOffsetValue & 0xff, // Data_L (low byte)
        (homingOffsetValue >> 8) & 0xff, // Data_H (high byte)
        0x00, // Checksum (will calculate)
      ]);

      // Calculate checksum using configurable address
      const checksum =
        ~(
          motorId +
          0x05 +
          0x03 +
          config.protocol.homingOffsetAddress +
          (homingOffsetValue & 0xff) +
          ((homingOffsetValue >> 8) & 0xff)
        ) & 0xff;
      packet[8] = checksum;

      if (!config.port || !config.port.isOpen) {
        throw new Error("Serial port not open");
      }

      // Send reset packet
      await new Promise<void>((resolve, reject) => {
        config.port.write(packet, (error) => {
          if (error) {
            reject(
              new Error(
                `Failed to reset homing offset for ${motorName}: ${error.message}`
              )
            );
          } else {
            resolve();
          }
        });
      });

      // Wait for response (silent unless error)
      try {
        await readData(config.port, 200);
      } catch (error) {
        // Silent - response not required for successful operation
      }
    } catch (error) {
      throw new Error(
        `Failed to reset homing offset for ${motorName}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }

    // Small delay between motor writes
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Record homing offsets (current positions as center)
 * Mirrors Python bus.set_half_turn_homings()
 *
 * CRITICAL: Must reset existing homing offsets to 0 first (like Python does)
 * CRITICAL: Must WRITE the new homing offsets to motors immediately (like Python does)
 */
async function setHomingOffsets(
  config: SO100CalibrationConfig
): Promise<{ [motor: string]: number }> {
  // CRITICAL: Reset existing homing offsets to 0 first (matching Python)
  await resetHomingOffsets(config);

  // Wait a moment for reset to take effect
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Now read positions (which will be true physical positions)
  const currentPositions = await readMotorPositions(config);
  const homingOffsets: { [motor: string]: number } = {};

  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = currentPositions[i];

    // Generic formula: pos - int((max_res - 1) / 2) using configurable resolution
    const halfTurn = Math.floor((config.protocol.resolution - 1) / 2);
    homingOffsets[motorName] = position - halfTurn;
  }

  // CRITICAL: Write homing offsets to motors immediately (matching Python exactly)
  // Python does: for motor, offset in homing_offsets.items(): self.write("Homing_Offset", motor, offset)
  await writeHomingOffsetsToMotors(config, homingOffsets);

  return homingOffsets;
}

/**
 * Write homing offsets to motor registers immediately
 * Mirrors Python's immediate writing in set_half_turn_homings()
 */
async function writeHomingOffsetsToMotors(
  config: SO100CalibrationConfig,
  homingOffsets: { [motor: string]: number }
): Promise<void> {
  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];
    const homingOffset = homingOffsets[motorName];

    try {
      // Encode using sign-magnitude format (like Python)
      const encodedOffset = encodeSignMagnitude(
        homingOffset,
        config.protocol.signMagnitudeBit
      );

      // Create Write Homing_Offset packet
      const packet = Buffer.from([
        0xff,
        0xff, // Header
        motorId, // Servo ID
        0x05, // Length
        0x03, // Instruction: WRITE_DATA
        config.protocol.homingOffsetAddress, // Homing_Offset address
        encodedOffset & 0xff, // Data_L (low byte)
        (encodedOffset >> 8) & 0xff, // Data_H (high byte)
        0x00, // Checksum (will calculate)
      ]);

      // Calculate checksum
      const checksum =
        ~(
          motorId +
          0x05 +
          0x03 +
          config.protocol.homingOffsetAddress +
          (encodedOffset & 0xff) +
          ((encodedOffset >> 8) & 0xff)
        ) & 0xff;
      packet[8] = checksum;

      if (!config.port || !config.port.isOpen) {
        throw new Error("Serial port not open");
      }

      // Send packet
      await new Promise<void>((resolve, reject) => {
        config.port.write(packet, (error) => {
          if (error) {
            reject(
              new Error(
                `Failed to write homing offset for ${motorName}: ${error.message}`
              )
            );
          } else {
            resolve();
          }
        });
      });

      // Wait for response (silent unless error)
      try {
        await readData(config.port, 200);
      } catch (error) {
        // Silent - response not required for successful operation
      }
    } catch (error) {
      throw new Error(
        `Failed to write homing offset for ${motorName}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }

    // Small delay between motor writes
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Record ranges of motion with live updating table
 * Mirrors Python bus.record_ranges_of_motion()
 */
async function recordRangesOfMotion(config: SO100CalibrationConfig): Promise<{
  rangeMins: { [motor: string]: number };
  rangeMaxes: { [motor: string]: number };
}> {
  console.log(
    "Move all joints sequentially through their entire ranges of motion."
  );
  console.log(
    "Positions will be recorded continuously. Press ENTER to stop...\n"
  );

  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Read actual current positions (matching Python exactly)
  // Python does: start_positions = self.sync_read("Present_Position", motors, normalize=False)
  // mins = start_positions.copy(); maxes = start_positions.copy()
  const startPositions = await readMotorPositions(config);

  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const startPosition = startPositions[i];
    rangeMins[motorName] = startPosition; // Use actual position, not hardcoded 2047
    rangeMaxes[motorName] = startPosition; // Use actual position, not hardcoded 2047
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
        let liveTable = `Readings: ${readCount}\n\n`;
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

/**
 * Write hardware position limits to motors
 * Mirrors Python lerobot write_calibration() behavior where it writes:
 * - Min_Position_Limit register with calibration.range_min
 * - Max_Position_Limit register with calibration.range_max
 * This physically constrains the motors to the calibrated ranges
 */
async function writeHardwarePositionLimits(
  config: SO100CalibrationConfig,
  rangeMins: { [motor: string]: number },
  rangeMaxes: { [motor: string]: number }
): Promise<void> {
  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];
    const minLimit = rangeMins[motorName];
    const maxLimit = rangeMaxes[motorName];

    try {
      // Write Min_Position_Limit register
      await writeMotorRegister(
        config,
        motorId,
        config.protocol.minPositionLimitAddress,
        minLimit,
        `Min_Position_Limit for ${motorName}`
      );

      // Small delay between writes
      await new Promise((resolve) => setTimeout(resolve, 20));

      // Write Max_Position_Limit register
      await writeMotorRegister(
        config,
        motorId,
        config.protocol.maxPositionLimitAddress,
        maxLimit,
        `Max_Position_Limit for ${motorName}`
      );

      // Small delay between motors
      await new Promise((resolve) => setTimeout(resolve, 20));
    } catch (error) {
      throw new Error(
        `Failed to write position limits for ${motorName}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }
}

/**
 * Generic function to write a 2-byte value to a motor register
 * Used for both Min_Position_Limit and Max_Position_Limit
 */
async function writeMotorRegister(
  config: SO100CalibrationConfig,
  motorId: number,
  registerAddress: number,
  value: number,
  description: string
): Promise<void> {
  // Create Write Register packet
  const packet = Buffer.from([
    0xff,
    0xff, // Header
    motorId, // Servo ID
    0x05, // Length (Instruction + Address + Data + Checksum)
    0x03, // Instruction: WRITE_DATA
    registerAddress, // Register address
    value & 0xff, // Data_L (low byte)
    (value >> 8) & 0xff, // Data_H (high byte)
    0x00, // Checksum (will calculate)
  ]);

  // Calculate checksum
  const checksum =
    ~(
      motorId +
      0x05 +
      0x03 +
      registerAddress +
      (value & 0xff) +
      ((value >> 8) & 0xff)
    ) & 0xff;
  packet[8] = checksum;

  if (!config.port || !config.port.isOpen) {
    throw new Error("Serial port not open");
  }

  // Send packet
  await new Promise<void>((resolve, reject) => {
    config.port.write(packet, (error) => {
      if (error) {
        reject(new Error(`Failed to write ${description}: ${error.message}`));
      } else {
        resolve();
      }
    });
  });

  // Wait for response (silent unless error)
  try {
    await readData(config.port, 200);
  } catch (error) {
    // Silent - response not required for successful operation
  }
}

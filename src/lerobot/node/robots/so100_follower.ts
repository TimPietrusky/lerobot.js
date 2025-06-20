/**
 * SO-100 Follower Robot implementation for Node.js
 * Mirrors Python lerobot/common/robots/so100_follower/so100_follower.py
 */

import { Robot } from "./robot.js";
import type { RobotConfig } from "./config.js";
import * as readline from "readline";

export class SO100Follower extends Robot {
  constructor(config: RobotConfig) {
    super(config);

    // Validate that this is an SO-100 follower config
    if (config.type !== "so100_follower") {
      throw new Error(
        `Invalid robot type: ${config.type}. Expected: so100_follower`
      );
    }
  }

  /**
   * Calibrate the SO-100 follower robot
   * NOTE: Calibration logic has been moved to shared/common/calibration.ts
   * This method is kept for backward compatibility but delegates to the main calibrate.ts
   */
  async calibrate(): Promise<void> {
    throw new Error(
      "Direct device calibration is deprecated. Use the main calibrate.ts orchestrator instead."
    );
  }

  /**
   * Initialize robot communication
   * For now, just test basic serial connectivity
   */
  private async initializeRobot(): Promise<void> {
    console.log("Initializing robot communication...");

    try {
      // For SO-100, we need to implement Feetech servo protocol
      // For now, just test that we can send/receive data
      console.log("Testing serial port connectivity...");

      // Try to ping servo ID 1 (shoulder_pan motor)
      // This is a very basic test - real implementation needs proper Feetech protocol
      const pingPacket = Buffer.from([0xff, 0xff, 0x01, 0x02, 0x01, 0xfb]); // Basic ping packet

      if (!this.port || !this.port.isOpen) {
        throw new Error("Serial port not open");
      }

      // Send ping packet
      await new Promise<void>((resolve, reject) => {
        this.port!.write(pingPacket, (error) => {
          if (error) {
            reject(new Error(`Failed to send ping: ${error.message}`));
          } else {
            resolve();
          }
        });
      });

      console.log("Ping packet sent successfully");

      // Try to read response with shorter timeout
      try {
        const response = await this.readData(1000); // 1 second timeout
        console.log(`Response received: ${response.length} bytes`);
      } catch (error) {
        console.log("No response received (expected for basic test)");
      }
    } catch (error) {
      throw new Error(
        `Serial communication test failed: ${
          error instanceof Error ? error.message : error
        }`
      );
    }

    console.log("Robot communication test completed.");
  }

  /**
   * Read current motor positions as a record with motor names
   * For teleoperation use
   */
  async getMotorPositions(): Promise<Record<string, number>> {
    const positions = await this.readMotorPositions();
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];

    const result: Record<string, number> = {};
    for (let i = 0; i < motorNames.length; i++) {
      result[motorNames[i]] = positions[i];
    }
    return result;
  }

  /**
   * Get calibration data for teleoperation
   * Returns position limits and offsets from calibration file
   */
  getCalibrationLimits(): Record<string, { min: number; max: number }> {
    if (!this.isCalibrated || !this.calibration) {
      console.warn("No calibration data available, using default limits");
      // Default STS3215 limits as fallback
      return {
        shoulder_pan: { min: 985, max: 3085 },
        shoulder_lift: { min: 1200, max: 2800 },
        elbow_flex: { min: 1000, max: 3000 },
        wrist_flex: { min: 1100, max: 2900 },
        wrist_roll: { min: 0, max: 4095 }, // Full rotation motor
        gripper: { min: 1800, max: 2300 },
      };
    }

    // Extract limits from calibration data (matches Python format)
    const limits: Record<string, { min: number; max: number }> = {};
    for (const [motorName, calibData] of Object.entries(this.calibration)) {
      if (
        calibData &&
        typeof calibData === "object" &&
        "range_min" in calibData &&
        "range_max" in calibData
      ) {
        limits[motorName] = {
          min: Number(calibData.range_min),
          max: Number(calibData.range_max),
        };
      }
    }

    return limits;
  }

  /**
   * Set motor positions from a record with motor names
   * For teleoperation use
   */
  async setMotorPositions(positions: Record<string, number>): Promise<void> {
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];
    const motorIds = [1, 2, 3, 4, 5, 6]; // SO-100 has servo IDs 1-6

    for (let i = 0; i < motorNames.length; i++) {
      const motorName = motorNames[i];
      const motorId = motorIds[i];
      const position = positions[motorName];

      if (position !== undefined) {
        await this.writeMotorPosition(motorId, position);
      }
    }
  }

  /**
   * Write position to a single motor
   * Implements STS3215 WRITE_DATA command for position control
   */
  private async writeMotorPosition(
    motorId: number,
    position: number
  ): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      throw new Error("Serial port not open");
    }

    // Clamp position to valid range
    const clampedPosition = Math.max(0, Math.min(4095, Math.round(position)));

    // Create STS3215 Write Position packet
    // Format: [0xFF, 0xFF, ID, Length, Instruction, Address, Data_L, Data_H, Checksum]
    // Goal_Position address for STS3215 is 42 (0x2A), length 2 bytes
    const packet = Buffer.from([
      0xff,
      0xff, // Header
      motorId, // Servo ID
      0x05, // Length (Instruction + Address + Data_L + Data_H + Checksum)
      0x03, // Instruction: WRITE_DATA
      0x2a, // Address: Goal_Position (42)
      clampedPosition & 0xff, // Data_L (low byte)
      (clampedPosition >> 8) & 0xff, // Data_H (high byte)
      0x00, // Checksum (will calculate)
    ]);

    // Calculate checksum: ~(ID + Length + Instruction + Address + Data_L + Data_H) & 0xFF
    const checksum =
      ~(
        motorId +
        0x05 +
        0x03 +
        0x2a +
        (clampedPosition & 0xff) +
        ((clampedPosition >> 8) & 0xff)
      ) & 0xff;
    packet[8] = checksum;

    // Send write position packet
    await new Promise<void>((resolve, reject) => {
      this.port!.write(packet, (error) => {
        if (error) {
          reject(new Error(`Failed to send write packet: ${error.message}`));
        } else {
          resolve();
        }
      });
    });

    // Small delay to allow servo to process command
    await new Promise((resolve) => setTimeout(resolve, 1));
  }

  /**
   * Read current motor positions
   * Implements basic STS3215 servo protocol to read actual positions
   */
  private async readMotorPositions(): Promise<number[]> {
    console.log("Reading motor positions...");

    const motorPositions: number[] = [];
    const motorIds = [1, 2, 3, 4, 5, 6]; // SO-100 has servo IDs 1-6
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];

    // Try to read position from each servo using STS3215 protocol
    for (let i = 0; i < motorIds.length; i++) {
      const motorId = motorIds[i];
      const motorName = motorNames[i];

      try {
        console.log(`  Reading ${motorName} (ID ${motorId})...`);

        // Create STS3215 Read Position packet
        // Format: [0xFF, 0xFF, ID, Length, Instruction, Address, DataLength, Checksum]
        // Present_Position address for STS3215 is 56 (0x38), length 2 bytes
        const packet = Buffer.from([
          0xff,
          0xff, // Header
          motorId, // Servo ID
          0x04, // Length (Instruction + Address + DataLength + Checksum)
          0x02, // Instruction: READ_DATA
          0x38, // Address: Present_Position (56)
          0x02, // Data Length: 2 bytes
          0x00, // Checksum (will calculate)
        ]);

        // Calculate checksum: ~(ID + Length + Instruction + Address + DataLength) & 0xFF
        const checksum = ~(motorId + 0x04 + 0x02 + 0x38 + 0x02) & 0xff;
        packet[7] = checksum;

        if (!this.port || !this.port.isOpen) {
          throw new Error("Serial port not open");
        }

        // Send read position packet
        await new Promise<void>((resolve, reject) => {
          this.port!.write(packet, (error) => {
            if (error) {
              reject(new Error(`Failed to send read packet: ${error.message}`));
            } else {
              resolve();
            }
          });
        });

        // Try to read response (timeout after 500ms)
        try {
          const response = await this.readData(500);

          if (response.length >= 7) {
            // Parse response: [0xFF, 0xFF, ID, Length, Error, Data_L, Data_H, Checksum]
            const id = response[2];
            const error = response[4];

            if (id === motorId && error === 0) {
              // Extract 16-bit position from Data_L and Data_H
              const position = response[5] | (response[6] << 8);
              motorPositions.push(position);

              // Show calibrated range if available
              const calibratedLimits = this.getCalibrationLimits();
              const limits = calibratedLimits[motorName];
              const rangeText = limits
                ? `(${limits.min}-${limits.max} calibrated)`
                : `(0-4095 raw)`;
              console.log(`    ${motorName}: ${position} ${rangeText}`);
            } else {
              console.warn(
                `    ${motorName}: Error response (error code: ${error})`
              );
              motorPositions.push(2047); // Use center position as fallback
            }
          } else {
            console.warn(`    ${motorName}: Invalid response length`);
            motorPositions.push(2047); // Use center position as fallback
          }
        } catch (readError) {
          console.warn(
            `    ${motorName}: Read timeout - using fallback position`
          );
          motorPositions.push(2047); // Use center position as fallback
        }
      } catch (error) {
        console.warn(
          `    ${motorName}: Communication error - ${
            error instanceof Error ? error.message : error
          }`
        );
        motorPositions.push(2047); // Use center position as fallback
      }

      // Small delay between servo reads
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    console.log(`Motor positions: [${motorPositions.join(", ")}]`);
    return motorPositions;
  }

  /**
   * Set motor limits and safety parameters
   * TODO: Implement proper Feetech servo protocol
   */
  private async setMotorLimits(): Promise<any> {
    console.log("Setting motor limits...");

    // Set default limits for SO-100 (based on Python implementation)
    const limits = {
      position_min: [-180, -90, -90, -90, -90, -90],
      position_max: [180, 90, 90, 90, 90, 90],
      velocity_max: [100, 100, 100, 100, 100, 100],
      torque_max: [50, 50, 50, 50, 25, 25],
    };

    // For now, just return the limits without sending to robot
    // Real implementation needs Feetech servo protocol to set limits
    console.log("Motor limits configured (mock).");
    return limits;
  }

  /**
   * Interactive calibration process - matches Python lerobot calibration flow
   * Implements real calibration with user interaction
   */
  private async calibrateMotors(): Promise<any> {
    console.log("\n=== INTERACTIVE CALIBRATION ===");
    console.log("Starting SO-100 follower arm calibration...");

    // Step 1: Move to middle position and record homing offsets
    console.log("\n📍 STEP 1: Set Homing Position");
    await this.promptUser(
      "Move the SO-100 to the MIDDLE of its range of motion and press ENTER..."
    );

    const homingOffsets = await this.setHomingOffsets();

    // Step 2: Record ranges of motion
    console.log("\n📏 STEP 2: Record Joint Ranges");
    const { rangeMins, rangeMaxes } = await this.recordRangesOfMotion();

    // Step 3: Set special range for wrist_roll (full turn motor)
    console.log("\n🔄 STEP 3: Configure Full-Turn Motor");
    console.log("Setting wrist_roll as full-turn motor (0-4095 range)");
    rangeMins["wrist_roll"] = 0;
    rangeMaxes["wrist_roll"] = 4095;

    // Step 4: Compile calibration results
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];
    const results = [];

    for (let i = 0; i < motorNames.length; i++) {
      const motorId = i + 1; // Servo IDs are 1-6
      const motorName = motorNames[i];

      results.push({
        motor: motorId,
        name: motorName,
        status: "success",
        homing_offset: homingOffsets[motorName],
        range_min: rangeMins[motorName],
        range_max: rangeMaxes[motorName],
        range_size: rangeMaxes[motorName] - rangeMins[motorName],
      });

      console.log(
        `✅ ${motorName} calibrated: range ${rangeMins[motorName]} to ${rangeMaxes[motorName]} (offset: ${homingOffsets[motorName]})`
      );
    }

    console.log("\n🎉 Interactive calibration completed!");
    return results;
  }

  /**
   * Verify calibration was successful
   * TODO: Implement proper verification with Feetech servo protocol
   */
  private async verifyCalibration(): Promise<void> {
    console.log("Verifying calibration...");

    // For now, just mock successful verification
    // Real implementation should check:
    // 1. All motors respond to ping
    // 2. Position limits are set correctly
    // 3. Homing offsets are applied
    // 4. Motors can move to test positions

    console.log("Calibration verification passed (mock).");
  }

  /**
   * Prompt user for input (like Python's input() function)
   */
  private async promptUser(message: string): Promise<string> {
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
   * Record homing offsets (current positions as center)
   * Mirrors Python bus.set_half_turn_homings()
   */
  private async setHomingOffsets(): Promise<{ [motor: string]: number }> {
    console.log("Recording current positions as homing offsets...");

    const currentPositions = await this.readMotorPositions();
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];
    const homingOffsets: { [motor: string]: number } = {};

    for (let i = 0; i < motorNames.length; i++) {
      const motorName = motorNames[i];
      const position = currentPositions[i];
      // Calculate homing offset (half turn offset from current position)
      const maxRes = 4095; // STS3215 resolution
      homingOffsets[motorName] = position - Math.floor(maxRes / 2);
      console.log(
        `  ${motorName}: offset ${homingOffsets[motorName]} (current pos: ${position})`
      );
    }

    return homingOffsets;
  }

  /**
   * Record ranges of motion by continuously reading positions
   * Mirrors Python bus.record_ranges_of_motion()
   */
  private async recordRangesOfMotion(): Promise<{
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

    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];
    const rangeMins: { [motor: string]: number } = {};
    const rangeMaxes: { [motor: string]: number } = {};

    // Initialize with current positions
    const initialPositions = await this.readMotorPositions();
    for (let i = 0; i < motorNames.length; i++) {
      const motorName = motorNames[i];
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

    // Continuous recording loop
    while (recording) {
      try {
        const positions = await this.readMotorPositions();
        readCount++;

        // Update min/max ranges
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

        // Show real-time feedback every 10 reads
        if (readCount % 10 === 0) {
          console.clear(); // Clear screen for live update
          console.log("=== LIVE POSITION RECORDING ===");
          console.log(`Readings: ${readCount} | Press ENTER to stop\n`);

          console.log("Motor Name       Current    Min      Max      Range");
          console.log("─".repeat(55));

          for (let i = 0; i < motorNames.length; i++) {
            const motorName = motorNames[i];
            const current = positions[i];
            const min = rangeMins[motorName];
            const max = rangeMaxes[motorName];
            const range = max - min;

            console.log(
              `${motorName.padEnd(15)} ${current.toString().padStart(6)} ${min
                .toString()
                .padStart(6)} ${max.toString().padStart(6)} ${range
                .toString()
                .padStart(8)}`
            );
          }
          console.log("\nMove joints through their full range...");
        }

        // Small delay to avoid overwhelming the serial port
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        console.warn(
          `Read error: ${error instanceof Error ? error.message : error}`
        );
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`\nRecording stopped after ${readCount} readings.`);
    console.log("\nFinal ranges recorded:");

    for (const motorName of motorNames) {
      const min = rangeMins[motorName];
      const max = rangeMaxes[motorName];
      const range = max - min;
      console.log(`  ${motorName}: ${min} to ${max} (range: ${range})`);
    }

    return { rangeMins, rangeMaxes };
  }
}

/**
 * Factory function to create SO-100 follower robot
 * Mirrors Python's make_robot_from_config pattern
 */
export function createSO100Follower(config: RobotConfig): SO100Follower {
  return new SO100Follower(config);
}

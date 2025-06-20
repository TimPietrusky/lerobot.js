/**
 * Web calibration functionality using Web Serial API
 * For browser environments - matches Node.js implementation exactly
 */

import type { CalibrateConfig } from "../node/robots/config.js";

/**
 * Device-agnostic calibration configuration for web
 * Mirrors the Node.js SO100CalibrationConfig exactly
 */
interface WebCalibrationConfig {
  deviceType: "so100_follower" | "so100_leader";
  port: WebSerialPortWrapper;
  motorNames: string[];
  motorIds: number[];
  driveModes: number[];
  calibModes: string[];

  // Protocol-specific configuration (matches Node.js exactly)
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

  limits: {
    position_min: number[];
    position_max: number[];
    velocity_max: number[];
    torque_max: number[];
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
 * STS3215 Protocol Configuration for web (matches Node.js exactly)
 */
const WEB_STS3215_PROTOCOL = {
  resolution: 4096, // 12-bit resolution (0-4095)
  homingOffsetAddress: 31, // Address for Homing_Offset register
  homingOffsetLength: 2, // 2 bytes for Homing_Offset
  presentPositionAddress: 56, // Address for Present_Position register
  presentPositionLength: 2, // 2 bytes for Present_Position
  minPositionLimitAddress: 9, // Address for Min_Position_Limit register
  minPositionLimitLength: 2, // 2 bytes for Min_Position_Limit
  maxPositionLimitAddress: 11, // Address for Max_Position_Limit register
  maxPositionLimitLength: 2, // 2 bytes for Max_Position_Limit
  signMagnitudeBit: 11, // Bit 11 is sign bit for Homing_Offset encoding
} as const;

/**
 * Sign-magnitude encoding functions (matches Node.js exactly)
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
 * PROPER Web Serial Port wrapper following Chrome documentation exactly
 * Direct write/read with immediate lock release - NO persistent connections
 */
class WebSerialPortWrapper {
  private port: SerialPort;

  constructor(port: SerialPort) {
    this.port = port;
  }

  get isOpen(): boolean {
    return (
      this.port !== null &&
      this.port.readable !== null &&
      this.port.writable !== null
    );
  }

  async initialize(): Promise<void> {
    if (!this.port.readable || !this.port.writable) {
      throw new Error("Port is not open for reading/writing");
    }
  }

  /**
   * Write data - EXACTLY like Chrome documentation
   * Get writer, write, release lock immediately
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.port.writable) {
      throw new Error("Port not open for writing");
    }

    // Write packet to motor

    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  /**
   * Read data - EXACTLY like Chrome documentation
   * Get reader, read once, release lock immediately
   */
  async read(timeout: number = 1000): Promise<Uint8Array> {
    if (!this.port.readable) {
      throw new Error("Port not open for reading");
    }

    const reader = this.port.readable.getReader();

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Read timeout")), timeout);
      });

      // Race between read and timeout
      const result = await Promise.race([reader.read(), timeoutPromise]);

      const { value, done } = result;

      if (done || !value) {
        throw new Error("Read failed - port closed or no data");
      }

      const response = new Uint8Array(value);
      return response;
    } finally {
      reader.releaseLock();
    }
  }

  async close(): Promise<void> {
    // Don't close the port itself - just wrapper cleanup
  }
}

/**
 * Read motor positions using device-agnostic configuration (exactly like Node.js)
 */
async function readMotorPositions(
  config: WebCalibrationConfig
): Promise<number[]> {
  const motorPositions: number[] = [];

  // Reading motor positions

  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];

    try {
      // Create Read Position packet using configurable address
      const packet = new Uint8Array([
        0xff,
        0xff,
        motorId,
        0x04,
        0x02,
        config.protocol.presentPositionAddress, // Configurable address
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

      // Professional Feetech communication pattern (based on matthieuvigne/STS_servos)
      let attempts = 0;
      let success = false;

      while (attempts < 3 && !success) {
        attempts++;

        // Clear any remaining data in buffer first (critical for Web Serial)
        try {
          await config.port.read(0); // Non-blocking read to clear buffer
        } catch (e) {
          // Expected - buffer was empty
        }

        // Write command with proper timing
        await config.port.write(packet);

        // Arduino library uses careful timing - Web Serial needs more
        await new Promise((resolve) => setTimeout(resolve, 10));

        const response = await config.port.read(150);

        if (response.length >= 7) {
          const id = response[2];
          const error = response[4];

          if (id === motorId && error === 0) {
            const position = response[5] | (response[6] << 8);
            motorPositions.push(position);
            success = true;
          } else if (id === motorId && error !== 0) {
            // Motor error, retry
          } else {
            // Wrong response ID, retry
          }
        } else {
          // Short response, retry
        }

        // Professional timing between attempts (like Arduino libraries)
        if (!success && attempts < 3) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      // If all attempts failed, use fallback
      if (!success) {
        const fallback = Math.floor((config.protocol.resolution - 1) / 2);
        motorPositions.push(fallback);
      }
    } catch (error) {
      const fallback = Math.floor((config.protocol.resolution - 1) / 2);
      motorPositions.push(fallback);
    }

    // Professional inter-motor delay (based on Arduino STS_servos library)
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return motorPositions;
}

/**
 * Reset homing offsets to 0 for all motors (matches Node.js exactly)
 */
async function resetHomingOffsets(config: WebCalibrationConfig): Promise<void> {
  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];

    try {
      const homingOffsetValue = 0;

      // Create Write Homing_Offset packet using configurable address
      const packet = new Uint8Array([
        0xff,
        0xff, // Header
        motorId, // Servo ID
        0x05, // Length
        0x03, // Instruction: WRITE_DATA
        config.protocol.homingOffsetAddress, // Configurable address
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

      // Simple write then read like Node.js
      await config.port.write(packet);

      // Wait for response (silent unless error)
      try {
        await config.port.read(200);
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
  }
}

/**
 * Write homing offsets to motor registers immediately (matches Node.js exactly)
 */
async function writeHomingOffsetsToMotors(
  config: WebCalibrationConfig,
  homingOffsets: { [motor: string]: number }
): Promise<void> {
  for (let i = 0; i < config.motorIds.length; i++) {
    const motorId = config.motorIds[i];
    const motorName = config.motorNames[i];
    const homingOffset = homingOffsets[motorName];

    try {
      // Encode using sign-magnitude format
      const encodedOffset = encodeSignMagnitude(
        homingOffset,
        config.protocol.signMagnitudeBit
      );

      // Create Write Homing_Offset packet
      const packet = new Uint8Array([
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

      // Simple write then read like Node.js
      await config.port.write(packet);

      // Wait for response (silent unless error)
      try {
        await config.port.read(200);
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
  }
}

/**
 * Record homing offsets with immediate writing (matches Node.js exactly)
 */
async function setHomingOffsets(
  config: WebCalibrationConfig
): Promise<{ [motor: string]: number }> {
  console.log("🏠 Setting homing offsets...");

  // CRITICAL: Reset existing homing offsets to 0 first (matching Python)
  await resetHomingOffsets(config);

  // Wait a moment for reset to take effect
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Now read positions (which will be true physical positions)
  const currentPositions = await readMotorPositions(config);
  const homingOffsets: { [motor: string]: number } = {};

  const halfTurn = Math.floor((config.protocol.resolution - 1) / 2);

  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = currentPositions[i];

    // Generic formula: pos - int((max_res - 1) / 2) using configurable resolution
    const homingOffset = position - halfTurn;
    homingOffsets[motorName] = homingOffset;
  }

  // CRITICAL: Write homing offsets to motors immediately (matching Python exactly)
  await writeHomingOffsetsToMotors(config, homingOffsets);

  return homingOffsets;
}

/**
 * Generic function to write a 2-byte value to a motor register (matches Node.js exactly)
 */
async function writeMotorRegister(
  config: WebCalibrationConfig,
  motorId: number,
  registerAddress: number,
  value: number,
  description: string
): Promise<void> {
  // Create Write Register packet
  const packet = new Uint8Array([
    0xff,
    0xff, // Header
    motorId, // Servo ID
    0x05, // Length
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

  // Simple write then read like Node.js
  await config.port.write(packet);

  // Wait for response (silent unless error)
  try {
    await config.port.read(200);
  } catch (error) {
    // Silent - response not required for successful operation
  }
}

/**
 * Write hardware position limits to motors (matches Node.js exactly)
 */
async function writeHardwarePositionLimits(
  config: WebCalibrationConfig,
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

      // Write Max_Position_Limit register
      await writeMotorRegister(
        config,
        motorId,
        config.protocol.maxPositionLimitAddress,
        maxLimit,
        `Max_Position_Limit for ${motorName}`
      );
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
 * Record ranges of motion with manual control (user decides when to stop)
 */
async function recordRangesOfMotion(
  config: WebCalibrationConfig,
  shouldStop: () => boolean,
  onUpdate?: (
    rangeMins: { [motor: string]: number },
    rangeMaxes: { [motor: string]: number },
    currentPositions: { [motor: string]: number }
  ) => void
): Promise<{
  rangeMins: { [motor: string]: number };
  rangeMaxes: { [motor: string]: number };
}> {
  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Read actual current positions (matching Python exactly)
  // After homing offsets are applied, these should be ~2047 (centered)
  const startPositions = await readMotorPositions(config);

  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const startPosition = startPositions[i];
    rangeMins[motorName] = startPosition; // Use actual position, not hardcoded 2047
    rangeMaxes[motorName] = startPosition; // Use actual position, not hardcoded 2047
  }

  // Manual recording using simple while loop like Node.js
  let recordingCount = 0;

  while (!shouldStop()) {
    try {
      const positions = await readMotorPositions(config);
      recordingCount++;

      for (let i = 0; i < config.motorNames.length; i++) {
        const motorName = config.motorNames[i];
        const position = positions[i];
        const oldMin = rangeMins[motorName];
        const oldMax = rangeMaxes[motorName];

        if (position < rangeMins[motorName]) {
          rangeMins[motorName] = position;
        }
        if (position > rangeMaxes[motorName]) {
          rangeMaxes[motorName] = position;
        }

        // Track range expansions silently
      }

      // Continue recording silently

      // Call update callback if provided (for live UI updates)
      if (onUpdate) {
        // Convert positions array to motor name map for UI
        const currentPositions: { [motor: string]: number } = {};
        for (let i = 0; i < config.motorNames.length; i++) {
          currentPositions[config.motorNames[i]] = positions[i];
        }
        onUpdate(rangeMins, rangeMaxes, currentPositions);
      }
    } catch (error) {
      console.warn("Error during range recording:", error);
    }

    // 20fps reading rate for stable Web Serial communication while maintaining responsive UI
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Range recording finished

  return { rangeMins, rangeMaxes };
}

/**
 * Interactive web calibration with manual control - user decides when to stop recording
 */
async function performWebCalibration(
  config: WebCalibrationConfig,
  shouldStopRecording: () => boolean,
  onRangeUpdate?: (
    rangeMins: { [motor: string]: number },
    rangeMaxes: { [motor: string]: number },
    currentPositions: { [motor: string]: number }
  ) => void
): Promise<WebCalibrationResults> {
  // Step 1: Set homing position
  const homingOffsets = await setHomingOffsets(config);

  // Step 2: Record ranges of motion with manual control
  const { rangeMins, rangeMaxes } = await recordRangesOfMotion(
    config,
    shouldStopRecording,
    onRangeUpdate
  );

  // Step 3: Set special range for wrist_roll (full turn motor)
  rangeMins["wrist_roll"] = 0;
  rangeMaxes["wrist_roll"] = 4095;

  // Step 4: Write hardware position limits to motors (matching Python behavior)
  await writeHardwarePositionLimits(config, rangeMins, rangeMaxes);

  // Compile results in Python-compatible format (NOT array format!)
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
}

/**
 * Step-by-step calibration for React components
 */
export class WebCalibrationController {
  private config: WebCalibrationConfig;
  private homingOffsets: { [motor: string]: number } | null = null;
  private rangeMins: { [motor: string]: number } | null = null;
  private rangeMaxes: { [motor: string]: number } | null = null;

  constructor(config: WebCalibrationConfig) {
    this.config = config;
  }

  async readMotorPositions(): Promise<number[]> {
    return await readMotorPositions(this.config);
  }

  async performHomingStep(): Promise<void> {
    this.homingOffsets = await setHomingOffsets(this.config);
  }

  async performRangeRecordingStep(
    shouldStop: () => boolean,
    onUpdate?: (
      rangeMins: { [motor: string]: number },
      rangeMaxes: { [motor: string]: number },
      currentPositions: { [motor: string]: number }
    ) => void
  ): Promise<void> {
    const { rangeMins, rangeMaxes } = await recordRangesOfMotion(
      this.config,
      shouldStop,
      onUpdate
    );
    this.rangeMins = rangeMins;
    this.rangeMaxes = rangeMaxes;

    // Set special range for wrist_roll (full turn motor)
    this.rangeMins["wrist_roll"] = 0;
    this.rangeMaxes["wrist_roll"] = 4095;
  }

  async finishCalibration(): Promise<WebCalibrationResults> {
    if (!this.homingOffsets || !this.rangeMins || !this.rangeMaxes) {
      throw new Error("Must complete all calibration steps first");
    }

    // Write hardware position limits to motors (matching Python behavior)
    await writeHardwarePositionLimits(
      this.config,
      this.rangeMins,
      this.rangeMaxes
    );

    // Compile results in Python-compatible format (NOT array format!)
    const results: WebCalibrationResults = {};

    for (let i = 0; i < this.config.motorNames.length; i++) {
      const motorName = this.config.motorNames[i];
      const motorId = this.config.motorIds[i];

      results[motorName] = {
        id: motorId,
        drive_mode: this.config.driveModes[i],
        homing_offset: this.homingOffsets[motorName],
        range_min: this.rangeMins[motorName],
        range_max: this.rangeMaxes[motorName],
      };
    }

    console.log("🎉 Calibration completed successfully!");
    return results;
  }
}

/**
 * Create SO-100 web configuration (matches Node.js exactly)
 */
function createSO100WebConfig(
  deviceType: "so100_follower" | "so100_leader",
  port: WebSerialPortWrapper
): WebCalibrationConfig {
  return {
    deviceType,
    port,
    motorNames: [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ],
    motorIds: [1, 2, 3, 4, 5, 6],
    protocol: WEB_STS3215_PROTOCOL,
    driveModes: [0, 0, 0, 0, 0, 0], // Python lerobot uses drive_mode=0 for all motors
    calibModes: ["DEGREE", "DEGREE", "DEGREE", "DEGREE", "DEGREE", "LINEAR"],
    limits: {
      position_min: [-180, -90, -90, -90, -90, -90],
      position_max: [180, 90, 90, 90, 90, 90],
      velocity_max: [100, 100, 100, 100, 100, 100],
      torque_max: [50, 50, 50, 50, 25, 25],
    },
  };
}

/**
 * Create a calibration controller for step-by-step calibration in React components
 */
export async function createCalibrationController(
  armType: "so100_follower" | "so100_leader",
  connectedPort: SerialPort
): Promise<WebCalibrationController> {
  // Create web serial port wrapper
  const port = new WebSerialPortWrapper(connectedPort);
  await port.initialize();

  // Get device-agnostic calibration configuration
  const config = createSO100WebConfig(armType, port);

  return new WebCalibrationController(config);
}

/**
 * Save calibration results to unified storage system
 */
export async function saveCalibrationResults(
  calibrationResults: WebCalibrationResults,
  armType: "so100_follower" | "so100_leader",
  armId: string,
  serialNumber: string,
  recordingCount: number = 0
): Promise<void> {
  // Prepare full calibration data
  const fullCalibrationData = {
    ...calibrationResults,
    device_type: armType,
    device_id: armId,
    calibrated_at: new Date().toISOString(),
    platform: "web",
    api: "Web Serial API",
  };

  const metadata = {
    timestamp: new Date().toISOString(),
    readCount: recordingCount,
  };

  // Try to save using unified storage system
  try {
    const { saveCalibrationData } = await import(
      "../../demo/lib/unified-storage.js"
    );
    saveCalibrationData(serialNumber, fullCalibrationData, metadata);
    console.log(
      `✅ Calibration saved to unified storage: lerobotjs-${serialNumber}`
    );
  } catch (error) {
    console.warn(
      "Failed to save to unified storage, falling back to old format:",
      error
    );

    // Fallback to old storage format for compatibility
    const fullDataKey = `lerobot_calibration_${armType}_${armId}`;
    localStorage.setItem(fullDataKey, JSON.stringify(fullCalibrationData));

    const dashboardKey = `lerobot-calibration-${serialNumber}`;
    localStorage.setItem(dashboardKey, JSON.stringify(metadata));

    console.log(`📊 Dashboard data saved to: ${dashboardKey}`);
    console.log(`🔧 Full calibration data saved to: ${fullDataKey}`);
  }
}

/**
 * Download calibration data as JSON file
 */
function downloadCalibrationFile(calibrationData: any, deviceId: string): void {
  const dataStr = JSON.stringify(calibrationData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${deviceId}_calibration.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Check if Web Serial API is supported
 */
export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

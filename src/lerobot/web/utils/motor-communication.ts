/**
 * Motor Communication Utilities
 * Proven patterns for STS3215 motor reading and writing operations
 */

import { STS3215_PROTOCOL } from "./sts3215-protocol.js";

/**
 * Interface for motor communication port
 * Compatible with both WebSerialPortWrapper and RobotConnectionManager
 */
export interface MotorCommunicationPort {
  write(data: Uint8Array): Promise<void>;
  read(timeout?: number): Promise<Uint8Array>;
}

/**
 * Read single motor position with PROVEN retry logic
 * Extracted from calibrate.ts with all proven timing and retry patterns
 */
export async function readMotorPosition(
  port: MotorCommunicationPort,
  motorId: number
): Promise<number | null> {
  try {
    // Create Read Position packet using proven pattern
    const packet = new Uint8Array([
      0xff,
      0xff, // Header
      motorId, // Servo ID
      0x04, // Length
      0x02, // Instruction: READ_DATA
      STS3215_PROTOCOL.PRESENT_POSITION_ADDRESS, // Present_Position register address
      0x02, // Data length (2 bytes)
      0x00, // Checksum placeholder
    ]);

    const checksum =
      ~(
        motorId +
        0x04 +
        0x02 +
        STS3215_PROTOCOL.PRESENT_POSITION_ADDRESS +
        0x02
      ) & 0xff;
    packet[7] = checksum;

    // PROVEN PATTERN: Professional Feetech communication with retry logic
    let attempts = 0;

    while (attempts < STS3215_PROTOCOL.MAX_RETRIES) {
      attempts++;

      // CRITICAL: Clear any remaining data in buffer first (from calibration lessons)
      try {
        await port.read(0); // Non-blocking read to clear buffer
      } catch (e) {
        // Expected - buffer was empty
      }

      // Write command with PROVEN timing
      await port.write(packet);

      // PROVEN TIMING: Arduino library uses careful timing - Web Serial needs more
      await new Promise((resolve) =>
        setTimeout(resolve, STS3215_PROTOCOL.WRITE_TO_READ_DELAY)
      );

      try {
        const response = await port.read(150);

        if (response.length >= 7) {
          const id = response[2];
          const error = response[4];

          if (id === motorId && error === 0) {
            const position = response[5] | (response[6] << 8);
            return position;
          }
        }
      } catch (readError) {
        // Read timeout, retry
      }

      // PROVEN TIMING: Professional timing between attempts
      if (attempts < STS3215_PROTOCOL.MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, STS3215_PROTOCOL.RETRY_DELAY)
        );
      }
    }

    // If all attempts failed, return null
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Read all motor positions with PROVEN patterns
 * Exactly matches calibrate.ts readMotorPositions() function
 */
export async function readAllMotorPositions(
  port: MotorCommunicationPort,
  motorIds: number[]
): Promise<number[]> {
  const motorPositions: number[] = [];

  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];

    const position = await readMotorPosition(port, motorId);

    if (position !== null) {
      motorPositions.push(position);
    } else {
      // Use fallback value for failed reads
      const fallback = Math.floor((STS3215_PROTOCOL.RESOLUTION - 1) / 2);
      motorPositions.push(fallback);
    }

    // PROVEN PATTERN: Professional inter-motor delay
    await new Promise((resolve) =>
      setTimeout(resolve, STS3215_PROTOCOL.INTER_MOTOR_DELAY)
    );
  }

  return motorPositions;
}

/**
 * Write motor goal position
 */
export async function writeMotorPosition(
  port: MotorCommunicationPort,
  motorId: number,
  position: number
): Promise<void> {
  // STS3215 Write Goal_Position packet
  const packet = new Uint8Array([
    0xff,
    0xff, // Header
    motorId, // Servo ID
    0x05, // Length
    0x03, // Instruction: WRITE_DATA
    STS3215_PROTOCOL.GOAL_POSITION_ADDRESS, // Goal_Position register address
    position & 0xff, // Position low byte
    (position >> 8) & 0xff, // Position high byte
    0x00, // Checksum placeholder
  ]);

  // Calculate checksum
  const checksum =
    ~(
      motorId +
      0x05 +
      0x03 +
      STS3215_PROTOCOL.GOAL_POSITION_ADDRESS +
      (position & 0xff) +
      ((position >> 8) & 0xff)
    ) & 0xff;
  packet[8] = checksum;

  await port.write(packet);
}

/**
 * Generic function to write a 2-byte value to a motor register
 * Matches calibrate.ts writeMotorRegister() exactly
 */
export async function writeMotorRegister(
  port: MotorCommunicationPort,
  motorId: number,
  registerAddress: number,
  value: number
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
    0x00, // Checksum placeholder
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

  // Simple write then read like calibration
  await port.write(packet);

  // Wait for response (silent unless error)
  try {
    await port.read(200);
  } catch (error) {
    // Silent - response not required for successful operation
  }
}

/**
 * Lock a motor (motor will hold its position and resist movement)
 */
export async function lockMotor(
  port: MotorCommunicationPort,
  motorId: number
): Promise<void> {
  await writeMotorRegister(
    port,
    motorId,
    STS3215_PROTOCOL.TORQUE_ENABLE_ADDRESS,
    1
  );
  // Small delay for command processing
  await new Promise((resolve) =>
    setTimeout(resolve, STS3215_PROTOCOL.WRITE_TO_READ_DELAY)
  );
}

/**
 * Release a motor (motor can be moved freely by hand)
 */
export async function releaseMotor(
  port: MotorCommunicationPort,
  motorId: number
): Promise<void> {
  await writeMotorRegister(
    port,
    motorId,
    STS3215_PROTOCOL.TORQUE_ENABLE_ADDRESS,
    0
  );
  // Small delay for command processing
  await new Promise((resolve) =>
    setTimeout(resolve, STS3215_PROTOCOL.WRITE_TO_READ_DELAY)
  );
}

/**
 * Release motors (motors can be moved freely - perfect for calibration)
 */
export async function releaseMotors(
  port: MotorCommunicationPort,
  motorIds: number[]
): Promise<void> {
  for (const motorId of motorIds) {
    await releaseMotor(port, motorId);
    // Small delay between motors
    await new Promise((resolve) =>
      setTimeout(resolve, STS3215_PROTOCOL.INTER_MOTOR_DELAY)
    );
  }
}

/**
 * Lock motors (motors will hold their positions - perfect after calibration)
 */
export async function lockMotors(
  port: MotorCommunicationPort,
  motorIds: number[]
): Promise<void> {
  for (const motorId of motorIds) {
    await lockMotor(port, motorId);
    // Small delay between motors
    await new Promise((resolve) =>
      setTimeout(resolve, STS3215_PROTOCOL.INTER_MOTOR_DELAY)
    );
  }
}

/**
 * Motor Communication Utilities
 * STS3215 motor reading and writing operations for Node.js
 */

import { STS3215_PROTOCOL } from "./sts3215-protocol.js";
import type { NodeSerialPortWrapper } from "./serial-port-wrapper.js";

/**
 * Interface for motor communication port
 * Compatible with NodeSerialPortWrapper
 */
export interface MotorCommunicationPort {
  write(data: Uint8Array): Promise<void>;
  read(timeout?: number): Promise<Uint8Array>;
}

/**
 * Read single motor position using OLD WORKING approach
 */
export async function readMotorPosition(
  port: MotorCommunicationPort,
  motorId: number
): Promise<number | null> {
  try {
    // Create Read Position packet (exactly like old working version)
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

    // Retry communication using OLD WORKING approach
    for (
      let attempts = 1;
      attempts <= STS3215_PROTOCOL.MAX_RETRIES;
      attempts++
    ) {
      try {
        // Write packet
        await port.write(packet);

        // Use OLD WORKING approach: direct port.once('data') event with proper cleanup
        const timeout = 100 * attempts; // Progressive timeout like old approach
        const response = await new Promise<Uint8Array>((resolve, reject) => {
          // Access underlying SerialPort for event-based reading
          const underlyingPort =
            (port as any).underlyingPort || (port as any).port;

          if (!underlyingPort || !underlyingPort.once) {
            reject(new Error("Cannot access underlying port for old approach"));
            return;
          }

          let isResolved = false;

          const dataHandler = (data: Buffer) => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timer);
              resolve(new Uint8Array(data));
            }
          };

          const timer = setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              // CRITICAL: Remove the event listener to prevent memory leak
              underlyingPort.removeListener("data", dataHandler);
              reject(new Error("Read timeout"));
            }
          }, timeout);

          // Attach event listener
          underlyingPort.once("data", dataHandler);
        });

        if (response.length >= 7) {
          const id = response[2];
          const error = response[4];

          if (id === motorId && error === 0) {
            const position = response[5] | (response[6] << 8);
            return position;
          }
        }
      } catch (readError) {
        if (attempts < STS3215_PROTOCOL.MAX_RETRIES) {
          // Wait between retry attempts (like old approach)
          const retryDelay = STS3215_PROTOCOL.RETRY_DELAY * attempts;
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // If all attempts failed, return null
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Read all motor positions
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

    // Delay between motor reads
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

  // Write register value
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

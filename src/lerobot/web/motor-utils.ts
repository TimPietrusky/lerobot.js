/**
 * Shared Motor Communication Utilities
 * Proven patterns from calibrate.ts for consistent motor communication
 * Used by both calibration and teleoperation
 */

export interface MotorCommunicationPort {
  write(data: Uint8Array): Promise<void>;
  read(timeout?: number): Promise<Uint8Array>;
}

/**
 * STS3215 Protocol Constants
 * Single source of truth for all motor communication
 */
export const STS3215_PROTOCOL = {
  // Register addresses
  PRESENT_POSITION_ADDRESS: 56,
  GOAL_POSITION_ADDRESS: 42,
  HOMING_OFFSET_ADDRESS: 31,
  MIN_POSITION_LIMIT_ADDRESS: 9,
  MAX_POSITION_LIMIT_ADDRESS: 11,

  // Protocol constants
  RESOLUTION: 4096, // 12-bit resolution (0-4095)
  SIGN_MAGNITUDE_BIT: 11, // Bit 11 is sign bit for Homing_Offset encoding

  // Communication timing (proven from calibration)
  WRITE_TO_READ_DELAY: 10,
  RETRY_DELAY: 20,
  INTER_MOTOR_DELAY: 10,
  MAX_RETRIES: 3,
} as const;

/**
 * Read single motor position with PROVEN retry logic
 * Reuses exact patterns from calibrate.ts
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
          } else if (id === motorId && error !== 0) {
            // Motor error, retry
          } else {
            // Wrong response ID, retry
          }
        } else {
          // Short response, retry
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
    console.warn(`Failed to read motor ${motorId} position:`, error);
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
 * Write motor position with error handling
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
 * Sign-magnitude encoding functions (from calibrate.ts)
 */
export function encodeSignMagnitude(
  value: number,
  signBitIndex: number = STS3215_PROTOCOL.SIGN_MAGNITUDE_BIT
): number {
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

export function decodeSignMagnitude(
  encodedValue: number,
  signBitIndex: number = STS3215_PROTOCOL.SIGN_MAGNITUDE_BIT
): number {
  const signBit = (encodedValue >> signBitIndex) & 1;
  const magnitude = encodedValue & ((1 << signBitIndex) - 1);
  return signBit ? -magnitude : magnitude;
}

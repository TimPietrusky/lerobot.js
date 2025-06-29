/**
 * Motor Calibration Utilities
 * Specialized functions for motor calibration procedures
 */

import { STS3215_PROTOCOL } from "./sts3215-protocol.js";
import { encodeSignMagnitude } from "./sign-magnitude.js";
import {
  readAllMotorPositions,
  writeMotorRegister,
  type MotorCommunicationPort,
} from "./motor-communication.js";

/**
 * Reset homing offsets to 0 for all motors
 */
export async function resetHomingOffsets(
  port: MotorCommunicationPort,
  motorIds: number[]
): Promise<void> {
  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];

    try {
      const packet = new Uint8Array([
        0xff,
        0xff,
        motorId,
        0x05,
        0x03,
        STS3215_PROTOCOL.HOMING_OFFSET_ADDRESS,
        0x00, // Low byte of 0
        0x00, // High byte of 0
        0x00, // Checksum
      ]);

      const checksum =
        ~(
          motorId +
          0x05 +
          0x03 +
          STS3215_PROTOCOL.HOMING_OFFSET_ADDRESS +
          0x00 +
          0x00
        ) & 0xff;
      packet[8] = checksum;

      await port.write(packet);

      try {
        await port.read(200);
      } catch (error) {
        // Silent - response not required
      }
    } catch (error) {
      throw new Error(`Failed to reset homing offset for motor ${motorId}`);
    }
  }
}

/**
 * Write homing offsets to motor registers immediately
 */
export async function writeHomingOffsetsToMotors(
  port: MotorCommunicationPort,
  motorIds: number[],
  motorNames: string[],
  homingOffsets: { [motor: string]: number }
): Promise<void> {
  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];
    const motorName = motorNames[i];
    const homingOffset = homingOffsets[motorName];

    try {
      const encodedOffset = encodeSignMagnitude(
        homingOffset,
        STS3215_PROTOCOL.SIGN_MAGNITUDE_BIT
      );

      const packet = new Uint8Array([
        0xff,
        0xff,
        motorId,
        0x05,
        0x03,
        STS3215_PROTOCOL.HOMING_OFFSET_ADDRESS,
        encodedOffset & 0xff,
        (encodedOffset >> 8) & 0xff,
        0x00,
      ]);

      const checksum =
        ~(
          motorId +
          0x05 +
          0x03 +
          STS3215_PROTOCOL.HOMING_OFFSET_ADDRESS +
          (encodedOffset & 0xff) +
          ((encodedOffset >> 8) & 0xff)
        ) & 0xff;
      packet[8] = checksum;

      await port.write(packet);

      try {
        await port.read(200);
      } catch (error) {
        // Silent - response not required
      }
    } catch (error) {
      throw new Error(`Failed to write homing offset for ${motorName}`);
    }
  }
}

/**
 * Set homing offsets with immediate writing
 */
export async function setHomingOffsets(
  port: MotorCommunicationPort,
  motorIds: number[],
  motorNames: string[]
): Promise<{ [motor: string]: number }> {
  // Reset existing homing offsets to 0 first
  await resetHomingOffsets(port, motorIds);
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Read positions (which will be true physical positions)
  const currentPositions = await readAllMotorPositions(port, motorIds);
  const homingOffsets: { [motor: string]: number } = {};

  const halfTurn = Math.floor((STS3215_PROTOCOL.RESOLUTION - 1) / 2);

  for (let i = 0; i < motorNames.length; i++) {
    const motorName = motorNames[i];
    const position = currentPositions[i];
    homingOffsets[motorName] = position - halfTurn;
  }

  // Write homing offsets to motors immediately
  await writeHomingOffsetsToMotors(port, motorIds, motorNames, homingOffsets);

  return homingOffsets;
}

/**
 * Write hardware position limits to motors
 */
export async function writeHardwarePositionLimits(
  port: MotorCommunicationPort,
  motorIds: number[],
  motorNames: string[],
  rangeMins: { [motor: string]: number },
  rangeMaxes: { [motor: string]: number }
): Promise<void> {
  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];
    const motorName = motorNames[i];
    const minLimit = rangeMins[motorName];
    const maxLimit = rangeMaxes[motorName];

    try {
      // Write Min_Position_Limit register
      await writeMotorRegister(
        port,
        motorId,
        STS3215_PROTOCOL.MIN_POSITION_LIMIT_ADDRESS,
        minLimit
      );

      // Write Max_Position_Limit register
      await writeMotorRegister(
        port,
        motorId,
        STS3215_PROTOCOL.MAX_POSITION_LIMIT_ADDRESS,
        maxLimit
      );
    } catch (error) {
      throw new Error(`Failed to write position limits for ${motorName}`);
    }
  }
}

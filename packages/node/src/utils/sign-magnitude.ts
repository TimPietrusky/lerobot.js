/**
 * Sign-Magnitude Encoding Utilities
 * For STS3215 motor homing offset encoding/decoding
 */

import { STS3215_PROTOCOL } from "./sts3215-protocol.js";

/**
 * Encode a signed integer using sign-magnitude format
 * Bit at sign_bit_index represents sign (0=positive, 1=negative)
 * Lower bits represent magnitude
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

/**
 * Decode a sign-magnitude encoded value back to signed integer
 * Extracts sign bit and magnitude, then applies sign
 */
export function decodeSignMagnitude(
  encodedValue: number,
  signBitIndex: number = STS3215_PROTOCOL.SIGN_MAGNITUDE_BIT
): number {
  const signBit = (encodedValue >> signBitIndex) & 1;
  const magnitude = encodedValue & ((1 << signBitIndex) - 1);
  return signBit ? -magnitude : magnitude;
} 
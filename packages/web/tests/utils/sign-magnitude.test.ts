import { describe, it, expect } from "vitest";
import {
  encodeSignMagnitude,
  decodeSignMagnitude,
} from "../../src/utils/sign-magnitude.js";

describe("sign-magnitude encoding", () => {
  it("should encode positive values correctly", () => {
    expect(encodeSignMagnitude(100)).toBe(100);
    expect(encodeSignMagnitude(2047)).toBe(2047);
    expect(encodeSignMagnitude(0)).toBe(0);
  });

  it("should encode negative values correctly", () => {
    expect(encodeSignMagnitude(-100)).toBe(0x800 | 100); // Set sign bit (bit 11)
    expect(encodeSignMagnitude(-2047)).toBe(0x800 | 2047);
    expect(encodeSignMagnitude(-1)).toBe(0x800 | 1);
  });

  it("should decode back to original values", () => {
    const testValues = [0, 1, 100, -100, 2047, -2047, -1];

    testValues.forEach((value) => {
      const encoded = encodeSignMagnitude(value);
      const decoded = decodeSignMagnitude(encoded);
      expect(decoded).toBe(value);
    });
  });

  it("should throw on magnitude overflow", () => {
    expect(() => encodeSignMagnitude(2048)).toThrow();
    expect(() => encodeSignMagnitude(-2048)).toThrow();
  });

  it("should handle edge cases", () => {
    // Test maximum positive value
    expect(encodeSignMagnitude(2047)).toBe(2047);
    expect(decodeSignMagnitude(2047)).toBe(2047);

    // Test maximum negative value
    expect(encodeSignMagnitude(-2047)).toBe(0x800 | 2047);
    expect(decodeSignMagnitude(0x800 | 2047)).toBe(-2047);
  });
});

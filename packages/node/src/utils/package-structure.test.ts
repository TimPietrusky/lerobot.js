/**
 * Node.js package structure tests
 * Basic tests to ensure imports and core functionality work
 */

import { describe, it, expect } from "vitest";
import { STS3215_PROTOCOL } from "./sts3215-protocol.js";
import { encodeSignMagnitude, decodeSignMagnitude } from "./sign-magnitude.js";
import {
  createSO100Config,
  SO100_KEYBOARD_CONTROLS,
} from "../robots/so100_config.js";

describe("Node.js Package Structure", () => {
  it("should export STS3215 protocol constants", () => {
    expect(STS3215_PROTOCOL.RESOLUTION).toBe(4096);
    expect(STS3215_PROTOCOL.PRESENT_POSITION_ADDRESS).toBe(56);
    expect(STS3215_PROTOCOL.HOMING_OFFSET_ADDRESS).toBe(31);
  });

  it("should handle sign-magnitude encoding/decoding", () => {
    // Test positive values
    expect(encodeSignMagnitude(100)).toBe(100);
    expect(decodeSignMagnitude(100)).toBe(100);

    // Test negative values
    const encoded = encodeSignMagnitude(-100);
    expect(decodeSignMagnitude(encoded)).toBe(-100);

    // Test zero
    expect(encodeSignMagnitude(0)).toBe(0);
    expect(decodeSignMagnitude(0)).toBe(0);
  });

  it("should create SO-100 robot configuration", () => {
    const config = createSO100Config("so100_follower");

    expect(config.deviceType).toBe("so100_follower");
    expect(config.motorNames).toHaveLength(6);
    expect(config.motorIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(config.driveModes).toEqual([0, 0, 0, 0, 0, 0]);
    expect(config.protocol.resolution).toBe(4096);
  });

  it("should have keyboard controls for SO-100", () => {
    expect(SO100_KEYBOARD_CONTROLS.w.motor).toBe("elbow_flex");
    expect(SO100_KEYBOARD_CONTROLS.ArrowUp.motor).toBe("shoulder_lift");
    expect(SO100_KEYBOARD_CONTROLS.q.motor).toBe("wrist_roll");
    expect(SO100_KEYBOARD_CONTROLS.o.motor).toBe("gripper");
  });
});

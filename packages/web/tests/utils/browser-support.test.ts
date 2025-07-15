import { describe, it, expect } from "vitest";
import {
  isWebSerialSupported,
  isWebUSBSupported,
} from "../../src/utils/browser-support.js";

describe("browser-support", () => {
  it("should detect Web Serial API support", () => {
    expect(isWebSerialSupported()).toBe(true);
  });

  it("should detect WebUSB API support", () => {
    expect(isWebUSBSupported()).toBe(true);
  });

  it("should handle missing Web Serial API gracefully", () => {
    const originalSerial = globalThis.navigator.serial;
    delete (globalThis.navigator as any).serial;

    expect(isWebSerialSupported()).toBe(false);

    // Restore
    globalThis.navigator.serial = originalSerial;
  });

  it("should handle missing WebUSB API gracefully", () => {
    const originalUSB = globalThis.navigator.usb;
    delete (globalThis.navigator as any).usb;

    expect(isWebUSBSupported()).toBe(false);

    // Restore
    globalThis.navigator.usb = originalUSB;
  });
});

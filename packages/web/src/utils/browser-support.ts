/**
 * Browser API support detection utilities
 * Centralized support checking to avoid duplication across modules
 */

import type { Serial, USB } from "../types/port-discovery.js";

declare global {
  interface Navigator {
    serial: Serial;
    usb: USB;
  }
}

/**
 * Check if Web Serial API is available in the current browser
 * @returns true if Web Serial is supported, false otherwise
 */
export function isWebSerialSupported(): boolean {
  return "serial" in navigator && typeof navigator.serial !== "undefined";
}

/**
 * Check if WebUSB API is available in the current browser
 * @returns true if WebUSB is supported, false otherwise
 */
export function isWebUSBSupported(): boolean {
  return "usb" in navigator && typeof navigator.usb !== "undefined";
}

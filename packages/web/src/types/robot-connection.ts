/**
 * Core robot connection types used across the lerobot.js web library
 * These types are shared between findPort, calibrate, teleoperate, and other modules
 */

import type { RobotHardwareConfig } from "./robot-config.js";

/**
 * Type definitions for WebSerial API (not yet in all TypeScript libs)
 */
export interface SerialPort {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  getInfo(): SerialPortInfo;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

export interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
}

/**
 * Unified robot connection interface used across all functions
 * This same object works for findPort, calibrate, teleoperate, etc.
 * Includes all fields needed by demo and other applications
 */
export interface RobotConnection {
  port: SerialPort;
  name: string; // Display name for UI
  isConnected: boolean; // Connection status
  robotType?: "so100_follower" | "so100_leader"; // Optional until user configures
  robotId?: string; // Optional until user configures
  serialNumber: string; // Always required for identification
  error?: string; // Error message if connection failed
  config?: RobotHardwareConfig; // Robot configuration (motorIds, controls, etc.) - set when robotType is configured
  usbMetadata?: {
    // USB device information
    vendorId: string;
    productId: string;
    serialNumber: string;
    manufacturerName: string;
    productName: string;
    usbVersionMajor?: number;
    usbVersionMinor?: number;
    deviceClass?: number;
    deviceSubclass?: number;
    deviceProtocol?: number;
  };
}

/**
 * Minimal robot config for finding/connecting to specific robots
 */
export interface RobotConfig {
  robotType: "so100_follower" | "so100_leader";
  robotId: string;
  serialNumber: string;
}

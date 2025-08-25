/**
 * Core robot connection types used across the lerobot.js Node.js library
 * These types are shared between findPort, calibrate, teleoperate, and other modules
 */

import type { RobotHardwareConfig } from "./robot-config.js";

/**
 * Type definitions for Node.js serialport API
 */
export interface SerialPort {
  path: string;
  write(buffer: Buffer): Promise<void>;
  read(): Promise<Buffer | null>;
  open(): Promise<void>;
  close(): Promise<void>;
  isOpen: boolean;
}

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
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
 * Includes all fields needed by CLI and other applications
 */
export interface RobotConnection {
  port: SerialPort;
  name: string; // Display name for CLI
  isConnected: boolean; // Connection status
  robotType?: "so100_follower" | "so100_leader"; // Optional until user configures
  robotId?: string; // Optional until user configures
  serialNumber: string; // Always required for identification
  error?: string; // Error message if connection failed
  config?: RobotHardwareConfig; // Robot configuration (motorIds, controls, etc.) - set when robotType is configured
  portInfo?: SerialPortInfo; // Node.js serial port information
}

/**
 * Minimal robot config for finding/connecting to specific robots
 */
export interface RobotConfig {
  robotType: "so100_follower" | "so100_leader";
  robotId: string; 
  serialNumber: string;
} 
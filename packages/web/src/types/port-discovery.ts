/**
 * Port discovery and WebSerial API types for web implementation
 */

// Import types needed in this file
import type {
  RobotConnection,
  RobotConfig,
  SerialPort,
} from "./robot-connection.js";

/**
 * Extended WebSerial API type definitions
 */
export interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

export interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

export interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

/**
 * WebUSB API type definitions
 */
export interface USBDevice {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  manufacturerName?: string;
  productName?: string;
  usbVersionMajor: number;
  usbVersionMinor: number;
  deviceClass: number;
  deviceSubclass: number;
  deviceProtocol: number;
}

export interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
}

export interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

export interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

/**
 * Config for findPort function
 */
export interface FindPortConfig {
  // Auto-connect mode: provide robot configs to connect to
  robotConfigs?: RobotConfig[];

  // Callbacks
  onMessage?: (message: string) => void;
  onRequestUserAction?: (
    message: string,
    type: "confirm" | "select"
  ) => Promise<boolean>;
}

/**
 * Process object returned by findPort
 */
export interface FindPortProcess {
  // Result promise - Always returns RobotConnection[] (consistent API)
  // Interactive mode: single robot in array
  // Auto-connect mode: all successfully connected robots in array
  result: Promise<RobotConnection[]>;

  // Control
  stop: () => void;
}

// Re-export commonly used types for convenience
export type { RobotConnection, RobotConfig, SerialPort };

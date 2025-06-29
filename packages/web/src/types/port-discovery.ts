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
 * Options for findPort function
 */
export interface FindPortOptions {
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

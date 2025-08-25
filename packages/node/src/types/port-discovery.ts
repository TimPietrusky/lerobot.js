/**
 * Port discovery types for Node.js implementation using serialport
 */

// Import types needed in this file
import type {
  RobotConnection,
  RobotConfig,
  SerialPort,
  SerialPortInfo,
} from "./robot-connection.js";

/**
 * Config for findPort function
 */
export interface FindPortConfig {
  // Interactive mode: shows Python lerobot compatible prompts
  interactive?: boolean;

  // Auto-connect mode: provide robot configs to connect to
  robotConfigs?: RobotConfig[];

  // Callbacks
  onMessage?: (message: string) => void;
}

/**
 * Process object returned by findPort
 */
export interface FindPortProcess {
  // Python lerobot compatible methods
  getAvailablePorts(): Promise<string[]>;
  detectPort(): Promise<string>; // Interactive cable detection

  // Result promise - Always returns RobotConnection[] (consistent API)
  // Interactive mode: single robot in array
  // Auto-connect mode: all successfully connected robots in array
  result?: Promise<RobotConnection[]>;

  // Control
  stop?: () => void;
}

// Re-export commonly used types for convenience
export type { RobotConnection, RobotConfig, SerialPort, SerialPortInfo }; 
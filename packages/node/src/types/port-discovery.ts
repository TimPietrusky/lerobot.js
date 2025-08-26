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
 * Discovered port information (Node.js discovery-only mode)
 */
export interface DiscoveredPort {
  path: string; // Serial port path (e.g., "/dev/ttyUSB0", "COM4")
  robotType: "so100_follower" | "so100_leader";
}

/**
 * Process object returned by findPort
 */
export interface FindPortProcess {
  // Result promise - Node.js returns discovered ports, user calls connectPort() separately
  result: Promise<DiscoveredPort[]>;

  // Control
  stop: () => void;
}

// Re-export commonly used types for convenience
export type { RobotConnection, RobotConfig, SerialPort, SerialPortInfo };

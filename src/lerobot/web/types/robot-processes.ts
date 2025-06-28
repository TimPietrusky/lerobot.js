/**
 * Robot connection management and process types for web implementation
 */

import type { SerialPort } from "./robot-connection.js";

/**
 * Robot connection state tracking
 */
export interface RobotConnectionState {
  isConnected: boolean;
  robotType?: "so100_follower" | "so100_leader";
  robotId?: string;
  serialNumber?: string;
  lastError?: string;
}

/**
 * Robot connection manager interface
 */
export interface RobotConnectionManager {
  // State
  getState(): RobotConnectionState;

  // Connection management
  connect(
    port: SerialPort,
    robotType: string,
    robotId: string,
    serialNumber: string
  ): Promise<void>;
  disconnect(): Promise<void>;

  // Port access
  getPort(): SerialPort | null;

  // Serial operations (shared by calibration, teleoperation, etc.)
  writeData(data: Uint8Array): Promise<void>;
  readData(timeout?: number): Promise<Uint8Array>;

  // Event system
  onStateChange(callback: (state: RobotConnectionState) => void): () => void;
}

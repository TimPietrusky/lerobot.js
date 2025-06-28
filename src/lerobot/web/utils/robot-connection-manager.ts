/**
 * Internal Robot Connection Manager Utility
 * Singleton manager providing shared robot connection state and communication
 * Used internally by calibrate, teleoperate, find_port, etc.
 *
 * This is an internal utility - users should not import this directly.
 * Instead, use the public APIs: calibrate(), findPort(), teleoperate()
 */

import type { MotorCommunicationPort } from "./motor-communication.js";
import type { SerialPort } from "../types/robot-connection.js";
import type {
  RobotConnectionState,
  RobotConnectionManager,
} from "../types/robot-processes.js";

/**
 * Singleton Robot Connection Manager Implementation
 */
class RobotConnectionManagerImpl implements RobotConnectionManager {
  private port: SerialPort | null = null;
  private state: RobotConnectionState = { isConnected: false };
  private stateChangeCallbacks: Set<(state: RobotConnectionState) => void> =
    new Set();

  getState(): RobotConnectionState {
    return { ...this.state };
  }

  async connect(
    port: SerialPort,
    robotType: string,
    robotId: string,
    serialNumber: string
  ): Promise<void> {
    try {
      // Validate port is open
      if (!port.readable || !port.writable) {
        throw new Error("Port is not open");
      }

      // Update connection state
      this.port = port;
      this.state = {
        isConnected: true,
        robotType: robotType as "so100_follower" | "so100_leader",
        robotId,
        serialNumber,
        lastError: undefined,
      };

      this.notifyStateChange();
      console.log(
        `🤖 Robot connected: ${robotType} (${robotId}) - ${serialNumber}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Connection failed";
      this.state = {
        isConnected: false,
        lastError: errorMessage,
      };
      this.notifyStateChange();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.port = null;
    this.state = { isConnected: false };
    this.notifyStateChange();
    console.log("🤖 Robot disconnected");
  }

  getPort(): SerialPort | null {
    return this.port;
  }

  async writeData(data: Uint8Array): Promise<void> {
    if (!this.port?.writable) {
      throw new Error("Robot not connected or port not writable");
    }

    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async readData(timeout: number = 1000): Promise<Uint8Array> {
    if (!this.port?.readable) {
      throw new Error("Robot not connected or port not readable");
    }

    const reader = this.port.readable.getReader();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Read timeout")), timeout);
      });

      const readPromise = reader
        .read()
        .then((result: { done: boolean; value?: Uint8Array }) => {
          if (result.done || !result.value) {
            throw new Error("Read failed - port closed or no data");
          }
          return result.value;
        });

      return await Promise.race([readPromise, timeoutPromise]);
    } finally {
      reader.releaseLock();
    }
  }

  onStateChange(callback: (state: RobotConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach((callback) => {
      try {
        callback(this.getState());
      } catch (error) {
        console.warn("Error in state change callback:", error);
      }
    });
  }
}

// Singleton instance
const robotConnectionManager = new RobotConnectionManagerImpl();

/**
 * Get the singleton robot connection manager
 * This is the single source of truth for robot connections
 */
export function getRobotConnectionManager(): RobotConnectionManager {
  return robotConnectionManager;
}

/**
 * Adapter to make robot connection manager compatible with motor-communication utilities
 * Provides the MotorCommunicationPort interface for the singleton manager
 */
export class RobotConnectionManagerAdapter implements MotorCommunicationPort {
  private manager: RobotConnectionManager;

  constructor(manager: RobotConnectionManager) {
    this.manager = manager;
  }

  async write(data: Uint8Array): Promise<void> {
    return this.manager.writeData(data);
  }

  async read(timeout?: number): Promise<Uint8Array> {
    return this.manager.readData(timeout);
  }
}

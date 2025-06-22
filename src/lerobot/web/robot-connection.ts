/**
 * Core Robot Connection Manager
 * Single source of truth for robot connections in the web library
 * Provides singleton access to robot ports and connection state
 */

import {
  readMotorPosition as readMotorPositionUtil,
  writeMotorPosition as writeMotorPositionUtil,
  readAllMotorPositions as readAllMotorPositionsUtil,
  writeMotorRegister,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";

export interface RobotConnectionState {
  isConnected: boolean;
  robotType?: "so100_follower" | "so100_leader";
  robotId?: string;
  serialNumber?: string;
  lastError?: string;
}

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

      const readPromise = reader.read().then((result) => {
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
 * Utility functions for common robot operations
 * Uses shared motor communication utilities for consistency
 */

/**
 * Adapter to make robot connection manager compatible with motor utils
 */
class RobotConnectionManagerAdapter implements MotorCommunicationPort {
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

export async function writeMotorPosition(
  motorId: number,
  position: number
): Promise<void> {
  const manager = getRobotConnectionManager();
  const adapter = new RobotConnectionManagerAdapter(manager);

  return writeMotorPositionUtil(adapter, motorId, position);
}

export async function readMotorPosition(
  motorId: number
): Promise<number | null> {
  const manager = getRobotConnectionManager();
  const adapter = new RobotConnectionManagerAdapter(manager);

  return readMotorPositionUtil(adapter, motorId);
}

export async function readAllMotorPositions(
  motorIds: number[]
): Promise<number[]> {
  const manager = getRobotConnectionManager();
  const adapter = new RobotConnectionManagerAdapter(manager);

  return readAllMotorPositionsUtil(adapter, motorIds);
}

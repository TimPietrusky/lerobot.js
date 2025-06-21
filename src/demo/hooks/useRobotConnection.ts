import { useState, useEffect, useCallback } from "react";
import {
  getRobotConnectionManager,
  type RobotConnectionState,
  writeMotorPosition,
  readMotorPosition,
  readAllMotorPositions,
} from "../../lerobot/web/robot-connection";

export interface UseRobotConnectionResult {
  // Connection state
  isConnected: boolean;
  robotType?: "so100_follower" | "so100_leader";
  robotId?: string;
  serialNumber?: string;
  lastError?: string;

  // Connection management
  connect: (
    port: SerialPort,
    robotType: string,
    robotId: string,
    serialNumber: string
  ) => Promise<void>;
  disconnect: () => Promise<void>;

  // Robot operations
  writeMotorPosition: (motorId: number, position: number) => Promise<void>;
  readMotorPosition: (motorId: number) => Promise<number | null>;
  readAllMotorPositions: (motorIds: number[]) => Promise<number[]>;

  // Raw port access (for advanced use cases)
  getPort: () => SerialPort | null;
}

/**
 * React hook for robot connection management
 * Uses the singleton connection manager as single source of truth
 */
export function useRobotConnection(): UseRobotConnectionResult {
  const manager = getRobotConnectionManager();
  const [state, setState] = useState<RobotConnectionState>(manager.getState());

  // Subscribe to connection state changes
  useEffect(() => {
    const unsubscribe = manager.onStateChange(setState);

    // Set initial state
    setState(manager.getState());

    return unsubscribe;
  }, [manager]);

  // Connection management functions
  const connect = useCallback(
    async (
      port: SerialPort,
      robotType: string,
      robotId: string,
      serialNumber: string
    ) => {
      await manager.connect(port, robotType, robotId, serialNumber);
    },
    [manager]
  );

  const disconnect = useCallback(async () => {
    await manager.disconnect();
  }, [manager]);

  const getPort = useCallback(() => {
    return manager.getPort();
  }, [manager]);

  return {
    // State
    isConnected: state.isConnected,
    robotType: state.robotType,
    robotId: state.robotId,
    serialNumber: state.serialNumber,
    lastError: state.lastError,

    // Methods
    connect,
    disconnect,
    writeMotorPosition,
    readMotorPosition,
    readAllMotorPositions,
    getPort,
  };
}

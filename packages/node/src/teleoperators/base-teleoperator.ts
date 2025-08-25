/**
 * Base teleoperator interface and abstract class for Node.js platform
 * Defines the contract that all teleoperators must implement
 */

import type { MotorConfig } from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";

/**
 * Base interface that all Node.js teleoperators must implement
 */
export interface NodeTeleoperator {
  initialize(): Promise<void>;
  start(): void;
  stop(): void;
  disconnect(): Promise<void>;
  getState(): TeleoperatorSpecificState;
  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void;
  motorConfigs: MotorConfig[];
}

/**
 * Teleoperator-specific state (union type for different teleoperator types)
 */
export type TeleoperatorSpecificState = {
  keyStates?: { [key: string]: { pressed: boolean; timestamp: number } }; // keyboard
  leaderPositions?: { [motor: string]: number }; // leader arm
};

/**
 * Base abstract class with common functionality for all teleoperators
 */
export abstract class BaseNodeTeleoperator implements NodeTeleoperator {
  protected port: MotorCommunicationPort;
  public motorConfigs: MotorConfig[] = [];
  protected isActive: boolean = false;

  constructor(port: MotorCommunicationPort, motorConfigs: MotorConfig[]) {
    this.port = port;
    this.motorConfigs = motorConfigs;
  }

  abstract initialize(): Promise<void>;
  abstract start(): void;
  abstract stop(): void;
  abstract getState(): TeleoperatorSpecificState;

  async disconnect(): Promise<void> {
    this.stop();
    if (this.port && "close" in this.port) {
      await (this.port as any).close();
    }
  }

  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void {
    this.motorConfigs = motorConfigs;
  }

  get isActiveTeleoperator(): boolean {
    return this.isActive;
  }
} 
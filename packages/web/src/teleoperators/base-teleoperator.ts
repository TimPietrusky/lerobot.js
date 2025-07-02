/**
 * Base teleoperator interface and abstract class for Web platform
 * Defines the contract that all teleoperators must implement
 */

import type { MotorConfig } from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";

/**
 * Base interface that all Web teleoperators must implement
 */
export interface WebTeleoperator {
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
  gamepadState?: { axes: number[]; buttons: boolean[] }; // gamepad
};

/**
 * Base abstract class with common functionality for all teleoperators
 */
export abstract class BaseWebTeleoperator implements WebTeleoperator {
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

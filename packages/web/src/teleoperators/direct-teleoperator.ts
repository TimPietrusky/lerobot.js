/**
 * Direct teleoperator for Web platform
 * Handles programmatic motor control (sliders, API calls, etc.)
 */

import {
  BaseWebTeleoperator,
  type TeleoperatorSpecificState,
} from "./base-teleoperator.js";
import type {
  DirectTeleoperatorConfig,
  MotorConfig,
  TeleoperationState,
} from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";
import {
  readMotorPosition,
  writeMotorPosition,
} from "../utils/motor-communication.js";

export class DirectTeleoperator extends BaseWebTeleoperator {
  private onStateUpdate?: (state: TeleoperationState) => void;

  constructor(
    config: DirectTeleoperatorConfig,
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    onStateUpdate?: (state: TeleoperationState) => void
  ) {
    super(port, motorConfigs);
    this.onStateUpdate = onStateUpdate;
  }

  async initialize(): Promise<void> {
    // Read current motor positions
    for (const config of this.motorConfigs) {
      const position = await readMotorPosition(this.port, config.id);
      if (position !== null) {
        config.currentPosition = position;
      }
    }
  }

  start(): void {
    this.isActive = true;
  }

  stop(): void {
    this.isActive = false;

    // Notify UI of state change
    if (this.onStateUpdate) {
      this.onStateUpdate(this.buildTeleoperationState());
    }
  }

  getState(): TeleoperatorSpecificState {
    return {};
  }

  /**
   * Move motor to exact position
   */
  async moveMotor(motorName: string, targetPosition: number): Promise<boolean> {
    const commandSentTimestamp = performance.now()/1000;
    const motorConfig = this.motorConfigs.find((m) => m.name === motorName);
    if (!motorConfig) return false;

    const clampedPosition = Math.max(
      motorConfig.minPosition,
      Math.min(motorConfig.maxPosition, targetPosition)
    );
    const prevMotorConfigs = structuredClone(this.motorConfigs)

    try {
      await writeMotorPosition(
        this.port,
        motorConfig.id,
        Math.round(clampedPosition)
      );
      motorConfig.currentPosition = clampedPosition;
      const positionChangedTimestamp = performance.now()/1000;

      // Notify UI of position change
      if (this.onStateUpdate) {
        this.onStateUpdate(this.buildTeleoperationState());
      }

      this.dispatchMotorPositionChanged(prevMotorConfigs,this.motorConfigs, commandSentTimestamp, positionChangedTimestamp);

      return true;
    } catch (error) {
      console.warn(`Failed to move motor ${motorName}:`, error);
      return false;
    }
  }

  /**
   * Set multiple motor positions at once
   */
  async setMotorPositions(positions: {
    [motorName: string]: number;
  }): Promise<boolean> {
    const commandSentTimestamp = performance.now()/1000;
    const prevMotorConfigs = structuredClone(this.motorConfigs)
    const results = await Promise.all(
      Object.entries(positions).map(([motorName, position]) =>
        this.moveMotor(motorName, position)
      )
    );
    const positionChangedTimestamp = performance.now()/1000;

    this.dispatchMotorPositionChanged(prevMotorConfigs,this.motorConfigs, commandSentTimestamp, positionChangedTimestamp);

    return results.every((result) => result);
  }

  private buildTeleoperationState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorConfigs: [...this.motorConfigs],
      lastUpdate: Date.now(),
    };
  }
}

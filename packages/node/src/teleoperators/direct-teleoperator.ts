/**
 * Direct teleoperator for Node.js platform
 * Provides programmatic control without user interface
 */

import {
  BaseNodeTeleoperator,
  type TeleoperatorSpecificState,
} from "./base-teleoperator.js";
import type {
  DirectTeleoperatorConfig,
  MotorConfig,
} from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";
import {
  readMotorPosition,
  writeMotorPosition,
} from "../utils/motor-communication.js";

/**
 * Direct teleoperator provides programmatic motor control
 * Use this when you want to control motors directly from code
 */
export class DirectTeleoperator extends BaseNodeTeleoperator {
  constructor(
    config: DirectTeleoperatorConfig,
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[]
  ) {
    super(port, motorConfigs);
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
  }

  getState(): TeleoperatorSpecificState {
    return {};
  }

  /**
   * Move motor to exact position (programmatic control)
   */
  async moveMotor(motorName: string, targetPosition: number): Promise<boolean> {
    if (!this.isActive) return false;

    const motorConfig = this.motorConfigs.find((m) => m.name === motorName);
    if (!motorConfig) return false;

    const clampedPosition = Math.max(
      motorConfig.minPosition,
      Math.min(motorConfig.maxPosition, targetPosition)
    );

    try {
      await writeMotorPosition(
        this.port,
        motorConfig.id,
        Math.round(clampedPosition)
      );
      motorConfig.currentPosition = clampedPosition;
      return true;
    } catch (error) {
      console.warn(`Failed to move motor ${motorName}:`, error);
      return false;
    }
  }

  /**
   * Move multiple motors simultaneously
   */
  async moveMotors(
    positions: { [motorName: string]: number }
  ): Promise<{ [motorName: string]: boolean }> {
    const results: { [motorName: string]: boolean } = {};
    
    const promises = Object.entries(positions).map(
      async ([motorName, position]) => {
        const success = await this.moveMotor(motorName, position);
        results[motorName] = success;
      }
    );

    await Promise.all(promises);
    return results;
  }

  /**
   * Get current motor positions
   */
  getCurrentPositions(): { [motorName: string]: number } {
    const positions: { [motorName: string]: number } = {};
    for (const config of this.motorConfigs) {
      positions[config.name] = config.currentPosition;
    }
    return positions;
  }
} 
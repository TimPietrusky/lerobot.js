/**
 * Keyboard teleoperator for Web platform
 */

import {
  BaseWebTeleoperator,
  type TeleoperatorSpecificState,
} from "./base-teleoperator.js";
import type { KeyboardControl } from "../types/robot-config.js";
import type {
  KeyboardTeleoperatorConfig,
  MotorConfig,
  TeleoperationState,
} from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";
import {
  readMotorPosition,
  writeMotorPosition,
} from "../utils/motor-communication.js";

/**
 * Default configuration values for keyboard teleoperator
 */
export const KEYBOARD_TELEOPERATOR_DEFAULTS = {
  stepSize: 8, // Position units per keypress (smooth responsive control)
  updateRate: 60, // Control loop FPS (60 Hz for smooth updates)
  keyTimeout: 10000, // Key state timeout in ms (10 seconds for virtual buttons)
} as const;

export class KeyboardTeleoperator extends BaseWebTeleoperator {
  private keyboardControls: { [key: string]: KeyboardControl } = {};
  private updateInterval: NodeJS.Timeout | null = null;
  private keyStates: {
    [key: string]: { pressed: boolean; timestamp: number };
  } = {};
  private onStateUpdate?: (state: TeleoperationState) => void;

  // Configuration values
  private readonly stepSize: number;
  private readonly updateRate: number;
  private readonly keyTimeout: number;

  constructor(
    config: KeyboardTeleoperatorConfig,
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    keyboardControls: { [key: string]: KeyboardControl },
    onStateUpdate?: (state: TeleoperationState) => void
  ) {
    super(port, motorConfigs);
    this.keyboardControls = keyboardControls;
    this.onStateUpdate = onStateUpdate;

    // Set configuration values
    this.stepSize = config.stepSize ?? KEYBOARD_TELEOPERATOR_DEFAULTS.stepSize;
    this.updateRate =
      config.updateRate ?? KEYBOARD_TELEOPERATOR_DEFAULTS.updateRate;
    this.keyTimeout =
      config.keyTimeout ?? KEYBOARD_TELEOPERATOR_DEFAULTS.keyTimeout;
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
    if (this.isActive) return;

    this.isActive = true;
    this.updateInterval = setInterval(() => {
      this.updateMotorPositions();
    }, 1000 / this.updateRate);
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Clear all key states
    this.keyStates = {};

    // Notify UI of state change
    if (this.onStateUpdate) {
      this.onStateUpdate(this.buildTeleoperationState());
    }
  }

  getState(): TeleoperatorSpecificState {
    return {
      keyStates: { ...this.keyStates },
    };
  }

  updateKeyState(key: string, pressed: boolean): void {
    this.keyStates[key] = {
      pressed,
      timestamp: Date.now(),
    };
  }

  /**
   * Move motor to exact position (for sliders and direct control)
   * This ensures sliders update the same motor configs that the UI displays
   */
  async moveMotor(motorName: string, targetPosition: number): Promise<boolean> {
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

      // Notify UI of position change for immediate slider update
      if (this.onStateUpdate) {
        this.onStateUpdate(this.buildTeleoperationState());
      }

      return true;
    } catch (error) {
      console.warn(`Failed to move motor ${motorName}:`, error);
      return false;
    }
  }

  private buildTeleoperationState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorConfigs: [...this.motorConfigs],
      lastUpdate: Date.now(),
      keyStates: { ...this.keyStates },
    };
  }

  /**
   * IMPORTANT: This method implements the WORKING keyboard control logic.
   *
   * ⚠️  DO NOT MODIFY THIS LOGIC! ⚠️
   *
   * This simple approach works perfectly:
   * - If key is pressed → apply movement every update cycle
   * - stepSize: 8 units per cycle at 60Hz = smooth, responsive control
   * - Single taps work naturally (brief key press = few cycles = small movement)
   * - Held keys work naturally (continuous press = continuous movement)
   *
   * Previous "improvements" that BROKE this:
   * ❌ Trying to detect "first press" vs "held" - breaks everything
   * ❌ Adding delays/thresholds - makes it clunky
   * ❌ Event-driven immediate movement - causes multiple applications
   * ❌ Higher stepSize values - too large jumps
   *
   * Keep it simple - this works!
   */
  private async updateMotorPositions(): Promise<void> {
    const now = Date.now();

    // Clear timed-out keys
    Object.keys(this.keyStates).forEach((key) => {
      if (now - this.keyStates[key].timestamp > this.keyTimeout) {
        delete this.keyStates[key];
      }
    });

    // Process active keys
    const activeKeys = Object.keys(this.keyStates).filter(
      (key) =>
        this.keyStates[key].pressed &&
        now - this.keyStates[key].timestamp <= this.keyTimeout
    );

    // Emergency stop check
    if (activeKeys.includes("Escape")) {
      this.stop();
      return;
    }

    // Calculate target positions based on active keys
    // SIMPLE RULE: If key is pressed → apply movement (works perfectly!)
    const targetPositions: { [motorName: string]: number } = {};

    for (const key of activeKeys) {
      const control = this.keyboardControls[key];
      if (!control || control.motor === "emergency_stop") continue;

      const motorConfig = this.motorConfigs.find(
        (m) => m.name === control.motor
      );
      if (!motorConfig) continue;

      // Calculate new position
      const currentTarget =
        targetPositions[motorConfig.name] ?? motorConfig.currentPosition;
      const newPosition = currentTarget + control.direction * this.stepSize;

      // Apply limits
      targetPositions[motorConfig.name] = Math.max(
        motorConfig.minPosition,
        Math.min(motorConfig.maxPosition, newPosition)
      );
    }

    // Send motor commands and update positions
    for (const [motorName, targetPosition] of Object.entries(targetPositions)) {
      const motorConfig = this.motorConfigs.find((m) => m.name === motorName);
      if (motorConfig && targetPosition !== motorConfig.currentPosition) {
        const commandSentTimestamp = performance.now();
        const prevPosition = motorConfig.currentPosition;
        
        try {
          await writeMotorPosition(
            this.port,
            motorConfig.id,
            Math.round(targetPosition)
          );
          
          motorConfig.currentPosition = targetPosition;
          const positionChangedTimestamp = performance.now();
          
          // Dispatch event for motor position change
          this.dispatchMotorPositionChanged(
            motorName,
            motorConfig, 
            prevPosition, 
            targetPosition, 
            commandSentTimestamp, 
            positionChangedTimestamp
          );
        } catch (error) {
          console.warn(
            `Failed to write motor ${motorConfig.id} position:`,
            error
          );
        }
      }
    }
  }
}

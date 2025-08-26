/**
 * Keyboard teleoperator for Node.js platform using stdin
 */

import {
  BaseNodeTeleoperator,
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
  stepSize: 8, // Keep browser demo step size
  updateRate: 120, // Higher frequency for smoother movement (120 Hz)
  keyTimeout: 150, // Shorter for better single taps, accept some gap on hold
} as const;

export class KeyboardTeleoperator extends BaseNodeTeleoperator {
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
    // Set up stdin for raw keyboard input
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Set up keyboard input handler
    process.stdin.on("data", this.handleKeyboardInput.bind(this));

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

    // Display keyboard controls
    this.displayControls();
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

    // Notify of state change
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

  private handleKeyboardInput(key: string): void {
    if (!this.isActive) return;

    // Handle special keys
    if (key === "\u0003") {
      // Ctrl+C
      process.exit(0);
    }

    if (key === "\u001b") {
      // Escape
      this.stop();
      return;
    }

    // Handle regular keys - START IMMEDIATE CONTINUOUS MOVEMENT
    const keyName = this.mapKeyToName(key);
    if (keyName && this.keyboardControls[keyName]) {
      // If key is already active, just refresh timestamp
      if (this.keyStates[keyName]) {
        this.keyStates[keyName].timestamp = Date.now();
      } else {
        // New key press - start continuous movement immediately
        this.updateKeyState(keyName, true);

        // Move immediately on first press (don't wait for interval)
        this.moveMotorForKey(keyName);
      }
    }
  }

  private moveMotorForKey(keyName: string): void {
    const control = this.keyboardControls[keyName];
    if (!control || control.motor === "emergency_stop") return;

    const motorConfig = this.motorConfigs.find((m) => m.name === control.motor);
    if (!motorConfig) return;

    // Calculate new position
    const newPosition =
      motorConfig.currentPosition + control.direction * this.stepSize;

    // Apply limits
    const clampedPosition = Math.max(
      motorConfig.minPosition,
      Math.min(motorConfig.maxPosition, newPosition)
    );

    // Send motor command immediately
    writeMotorPosition(this.port, motorConfig.id, Math.round(clampedPosition))
      .then(() => {
        motorConfig.currentPosition = clampedPosition;
      })
      .catch((error) => {
        console.warn(`Failed to move motor ${motorConfig.id}:`, error);
      });
  }

  private updateMotorPositions(): void {
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
    Object.entries(targetPositions).forEach(([motorName, targetPosition]) => {
      const motorConfig = this.motorConfigs.find((m) => m.name === motorName);
      if (motorConfig && targetPosition !== motorConfig.currentPosition) {
        writeMotorPosition(
          this.port,
          motorConfig.id,
          Math.round(targetPosition)
        )
          .then(() => {
            motorConfig.currentPosition = targetPosition;
          })
          .catch((error) => {
            console.warn(
              `Failed to write motor ${motorConfig.id} position:`,
              error
            );
          });
      }
    });
  }

  private mapKeyToName(key: string): string | null {
    // Map stdin input to key names
    const keyMap: { [key: string]: string } = {
      "\u001b[A": "ArrowUp",
      "\u001b[B": "ArrowDown",
      "\u001b[C": "ArrowRight",
      "\u001b[D": "ArrowLeft",
      w: "w",
      s: "s",
      a: "a",
      d: "d",
      q: "q",
      e: "e",
      o: "o",
      c: "c",
    };

    return keyMap[key] || null;
  }

  private displayControls(): void {
    console.log("\n=== Robot Teleoperation Controls ===");
    console.log("Arrow Keys: Shoulder pan/lift");
    console.log("WASD: Elbow flex / Wrist flex");
    console.log("Q/E: Wrist roll");
    console.log("O/C: Gripper open/close");
    console.log("ESC: Emergency stop");
    console.log("Ctrl+C: Exit");
    console.log("=====================================\n");
  }

  private buildTeleoperationState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorConfigs: [...this.motorConfigs],
      lastUpdate: Date.now(),
      keyStates: { ...this.keyStates },
    };
  }
}

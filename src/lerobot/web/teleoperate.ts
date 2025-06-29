/**
 * Web teleoperation functionality using Web Serial API
 */

import { createSO100Config } from "./robots/so100_config.js";
import type {
  RobotHardwareConfig,
  KeyboardControl,
} from "./types/robot-config.js";
import type { RobotConnection } from "./types/robot-connection.js";
import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import {
  readMotorPosition,
  writeMotorPosition,
  type MotorCommunicationPort,
} from "./utils/motor-communication.js";
import type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
} from "./types/teleoperation.js";

// Re-export types for external use
export type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
} from "./types/teleoperation.js";

/**
 * Create motor configurations from robot hardware config
 * Pure function - converts robot specs to motor configs with defaults
 */
function createMotorConfigsFromRobotConfig(
  robotConfig: RobotHardwareConfig
): MotorConfig[] {
  return robotConfig.motorNames.map((name: string, i: number) => ({
    id: robotConfig.motorIds[i],
    name,
    currentPosition: 2048,
    minPosition: 1024,
    maxPosition: 3072,
  }));
}

/**
 * Apply calibration data to motor configurations
 * Pure function - takes calibration data as parameter
 */
export function applyCalibrationToMotorConfigs(
  defaultConfigs: MotorConfig[],
  calibrationData: { [motorName: string]: any }
): MotorConfig[] {
  return defaultConfigs.map((defaultConfig) => {
    const calibData = calibrationData[defaultConfig.name];

    if (
      calibData &&
      typeof calibData === "object" &&
      "id" in calibData &&
      "range_min" in calibData &&
      "range_max" in calibData
    ) {
      // Use calibrated values but keep current position as default
      return {
        ...defaultConfig,
        id: calibData.id,
        minPosition: calibData.range_min,
        maxPosition: calibData.range_max,
      };
    }

    return defaultConfig;
  });
}

/**
 * Web teleoperation controller
 * Now uses shared utilities instead of custom port handling
 */
export class WebTeleoperationController {
  private port: MotorCommunicationPort;
  private motorConfigs: MotorConfig[] = [];
  private keyboardControls: { [key: string]: KeyboardControl } = {};
  private isActive: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private keyStates: {
    [key: string]: { pressed: boolean; timestamp: number };
  } = {};
  private onStateUpdate?: (state: TeleoperationState) => void;

  // Movement parameters
  private readonly STEP_SIZE = 8;
  private readonly UPDATE_RATE = 60; // 60 FPS
  private readonly KEY_TIMEOUT = 600; // ms - longer than browser keyboard repeat delay (~500ms)

  constructor(
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    keyboardControls: { [key: string]: KeyboardControl },
    onStateUpdate?: (state: TeleoperationState) => void
  ) {
    this.port = port;
    this.motorConfigs = motorConfigs;
    this.keyboardControls = keyboardControls;
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

  getMotorConfigs(): MotorConfig[] {
    return [...this.motorConfigs];
  }

  getState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorConfigs: [...this.motorConfigs],
      lastUpdate: Date.now(),
      keyStates: { ...this.keyStates },
    };
  }

  updateKeyState(key: string, pressed: boolean): void {
    this.keyStates[key] = {
      pressed,
      timestamp: Date.now(),
    };
  }

  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.updateInterval = setInterval(() => {
      this.updateMotorPositions();
    }, 1000 / this.UPDATE_RATE);

    console.log("🎮 Web teleoperation started");
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

    console.log("⏹️ Web teleoperation stopped");

    // Notify UI of state change
    if (this.onStateUpdate) {
      this.onStateUpdate(this.getState());
    }
  }

  async disconnect(): Promise<void> {
    this.stop();
    // No need to manually disconnect - port wrapper handles this
  }

  private updateMotorPositions(): void {
    const now = Date.now();

    // Clear timed-out keys
    Object.keys(this.keyStates).forEach((key) => {
      if (now - this.keyStates[key].timestamp > this.KEY_TIMEOUT) {
        delete this.keyStates[key];
      }
    });

    // Process active keys
    const activeKeys = Object.keys(this.keyStates).filter(
      (key) =>
        this.keyStates[key].pressed &&
        now - this.keyStates[key].timestamp <= this.KEY_TIMEOUT
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
      const newPosition = currentTarget + control.direction * this.STEP_SIZE;

      // Apply limits
      targetPositions[motorConfig.name] = Math.max(
        motorConfig.minPosition,
        Math.min(motorConfig.maxPosition, newPosition)
      );
    }

    // Send motor commands
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

  // Programmatic control methods
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
      return true;
    } catch (error) {
      console.warn(`Failed to move motor ${motorName}:`, error);
      return false;
    }
  }

  async setMotorPositions(positions: {
    [motorName: string]: number;
  }): Promise<boolean> {
    const results = await Promise.all(
      Object.entries(positions).map(([motorName, position]) =>
        this.moveMotor(motorName, position)
      )
    );

    return results.every((result) => result);
  }
}

/**
 * Main teleoperate function - simple API
 * Handles robot types internally, creates appropriate motor configurations
 */
export async function teleoperate(
  robotConnection: RobotConnection,
  options?: {
    calibrationData?: { [motorName: string]: any };
    onStateUpdate?: (state: TeleoperationState) => void;
  }
): Promise<TeleoperationProcess> {
  // Validate required fields
  if (!robotConnection.robotType) {
    throw new Error(
      "Robot type is required for teleoperation. Please configure the robot first."
    );
  }

  // Create web serial port wrapper
  const port = new WebSerialPortWrapper(robotConnection.port);
  await port.initialize();

  // Get robot-specific configuration
  let config: RobotHardwareConfig;
  if (robotConnection.robotType.startsWith("so100")) {
    config = createSO100Config(robotConnection.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${robotConnection.robotType}`);
  }

  // Create motor configs from robot hardware specs (single call, no duplication)
  const defaultMotorConfigs = createMotorConfigsFromRobotConfig(config);

  // Apply calibration data if provided
  const motorConfigs = options?.calibrationData
    ? applyCalibrationToMotorConfigs(
        defaultMotorConfigs,
        options.calibrationData
      )
    : defaultMotorConfigs;

  // Create and initialize controller using shared utilities
  const controller = new WebTeleoperationController(
    port,
    motorConfigs,
    config.keyboardControls,
    options?.onStateUpdate
  );
  await controller.initialize();

  // Wrap controller in process object
  return {
    start: () => {
      controller.start();
      // Optional state update callback
      if (options?.onStateUpdate) {
        const updateLoop = () => {
          if (controller.getState().isActive) {
            options.onStateUpdate!(controller.getState());
            setTimeout(updateLoop, 100); // 10fps state updates
          }
        };
        updateLoop();
      }
    },
    stop: () => controller.stop(),
    updateKeyState: (key: string, pressed: boolean) =>
      controller.updateKeyState(key, pressed),
    getState: () => controller.getState(),
    moveMotor: (motorName: string, position: number) =>
      controller.moveMotor(motorName, position),
    setMotorPositions: (positions: { [motorName: string]: number }) =>
      controller.setMotorPositions(positions),
    disconnect: () => controller.disconnect(),
  };
}

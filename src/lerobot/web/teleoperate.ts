/**
 * Web teleoperation functionality using Web Serial API
 * Mirrors the Node.js implementation but adapted for browser environment
 */

import type { UnifiedRobotData } from "../../demo/lib/unified-storage.js";

/**
 * Motor position and limits for teleoperation
 */
export interface MotorConfig {
  id: number;
  name: string;
  currentPosition: number;
  minPosition: number;
  maxPosition: number;
  homePosition: number;
}

/**
 * Teleoperation state
 */
export interface TeleoperationState {
  isActive: boolean;
  motorConfigs: MotorConfig[];
  lastUpdate: number;
  keyStates: { [key: string]: { pressed: boolean; timestamp: number } };
}

/**
 * Keyboard control mapping (matches Node.js version)
 */
export const KEYBOARD_CONTROLS = {
  // Shoulder controls
  ArrowUp: { motor: "shoulder_lift", direction: 1, description: "Shoulder up" },
  ArrowDown: {
    motor: "shoulder_lift",
    direction: -1,
    description: "Shoulder down",
  },
  ArrowLeft: {
    motor: "shoulder_pan",
    direction: -1,
    description: "Shoulder left",
  },
  ArrowRight: {
    motor: "shoulder_pan",
    direction: 1,
    description: "Shoulder right",
  },

  // WASD controls
  w: { motor: "elbow_flex", direction: 1, description: "Elbow flex" },
  s: { motor: "elbow_flex", direction: -1, description: "Elbow extend" },
  a: { motor: "wrist_flex", direction: -1, description: "Wrist down" },
  d: { motor: "wrist_flex", direction: 1, description: "Wrist up" },

  // Wrist roll and gripper
  q: { motor: "wrist_roll", direction: -1, description: "Wrist roll left" },
  e: { motor: "wrist_roll", direction: 1, description: "Wrist roll right" },
  o: { motor: "gripper", direction: 1, description: "Gripper open" },
  c: { motor: "gripper", direction: -1, description: "Gripper close" },

  // Emergency stop
  Escape: {
    motor: "emergency_stop",
    direction: 0,
    description: "Emergency stop",
  },
} as const;

/**
 * Web Serial Port wrapper for teleoperation
 * Uses the same pattern as calibration - per-operation reader/writer access
 */
class WebTeleoperationPort {
  private port: SerialPort;

  constructor(port: SerialPort) {
    this.port = port;
  }

  get isOpen(): boolean {
    return (
      this.port !== null &&
      this.port.readable !== null &&
      this.port.writable !== null
    );
  }

  async initialize(): Promise<void> {
    if (!this.port.readable || !this.port.writable) {
      throw new Error("Port is not open for teleoperation");
    }
    // Port is already open and ready - no need to grab persistent readers/writers
  }

  async writeMotorPosition(
    motorId: number,
    position: number
  ): Promise<boolean> {
    if (!this.port.writable) {
      throw new Error("Port not open for writing");
    }

    try {
      // STS3215 Write Goal_Position packet (matches Node.js exactly)
      const packet = new Uint8Array([
        0xff,
        0xff, // Header
        motorId, // Servo ID
        0x05, // Length
        0x03, // Instruction: WRITE_DATA
        42, // Goal_Position register address
        position & 0xff, // Position low byte
        (position >> 8) & 0xff, // Position high byte
        0x00, // Checksum placeholder
      ]);

      // Calculate checksum
      const checksum =
        ~(
          motorId +
          0x05 +
          0x03 +
          42 +
          (position & 0xff) +
          ((position >> 8) & 0xff)
        ) & 0xff;
      packet[8] = checksum;

      // Use per-operation writer like calibration does
      const writer = this.port.writable.getWriter();
      try {
        await writer.write(packet);
        return true;
      } finally {
        writer.releaseLock();
      }
    } catch (error) {
      console.warn(`Failed to write motor ${motorId} position:`, error);
      return false;
    }
  }

  async readMotorPosition(motorId: number): Promise<number | null> {
    if (!this.port.writable || !this.port.readable) {
      throw new Error("Port not open for reading/writing");
    }

    const writer = this.port.writable.getWriter();
    const reader = this.port.readable.getReader();

    try {
      // STS3215 Read Present_Position packet
      const packet = new Uint8Array([
        0xff,
        0xff, // Header
        motorId, // Servo ID
        0x04, // Length
        0x02, // Instruction: READ_DATA
        56, // Present_Position register address
        0x02, // Data length (2 bytes)
        0x00, // Checksum placeholder
      ]);

      const checksum = ~(motorId + 0x04 + 0x02 + 56 + 0x02) & 0xff;
      packet[7] = checksum;

      // Clear buffer first
      try {
        const { value, done } = await reader.read();
        if (done) return null;
      } catch (e) {
        // Buffer was empty, continue
      }

      await writer.write(packet);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const { value: response, done } = await reader.read();
      if (done || !response || response.length < 7) {
        return null;
      }

      const id = response[2];
      const error = response[4];

      if (id === motorId && error === 0) {
        return response[5] | (response[6] << 8);
      }

      return null;
    } catch (error) {
      console.warn(`Failed to read motor ${motorId} position:`, error);
      return null;
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }
  }

  async disconnect(): Promise<void> {
    // Don't close the port itself - just cleanup wrapper
    // The port is managed by PortManager
  }
}

/**
 * Load calibration data from unified storage with fallback to defaults
 * Improved version that properly loads and applies calibration ranges
 */
export function loadCalibrationConfig(serialNumber: string): MotorConfig[] {
  // Default SO-100 configuration (matches Node.js defaults)
  const defaultConfigs: MotorConfig[] = [
    {
      id: 1,
      name: "shoulder_pan",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
    {
      id: 2,
      name: "shoulder_lift",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
    {
      id: 3,
      name: "elbow_flex",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
    {
      id: 4,
      name: "wrist_flex",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
    {
      id: 5,
      name: "wrist_roll",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
    {
      id: 6,
      name: "gripper",
      currentPosition: 2048,
      minPosition: 1024,
      maxPosition: 3072,
      homePosition: 2048,
    },
  ];

  try {
    // Load from unified storage
    const unifiedKey = `lerobotjs-${serialNumber}`;
    const unifiedDataRaw = localStorage.getItem(unifiedKey);

    if (!unifiedDataRaw) {
      console.log(
        `No calibration data found for ${serialNumber}, using defaults`
      );
      return defaultConfigs;
    }

    const unifiedData: UnifiedRobotData = JSON.parse(unifiedDataRaw);

    if (!unifiedData.calibration) {
      console.log(
        `No calibration in unified data for ${serialNumber}, using defaults`
      );
      return defaultConfigs;
    }

    // Map calibration data to motor configs
    const calibratedConfigs: MotorConfig[] = defaultConfigs.map(
      (defaultConfig) => {
        const calibData = (unifiedData.calibration as any)?.[
          defaultConfig.name
        ];

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
            homePosition: Math.floor(
              (calibData.range_min + calibData.range_max) / 2
            ),
          };
        }

        return defaultConfig;
      }
    );

    console.log(`✅ Loaded calibration data for ${serialNumber}`);
    return calibratedConfigs;
  } catch (error) {
    console.warn(`Failed to load calibration for ${serialNumber}:`, error);
    return defaultConfigs;
  }
}

/**
 * Web teleoperation controller
 */
export class WebTeleoperationController {
  private port: WebTeleoperationPort;
  private motorConfigs: MotorConfig[] = [];
  private isActive: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;
  private keyStates: {
    [key: string]: { pressed: boolean; timestamp: number };
  } = {};

  // Movement parameters (matches Node.js)
  private readonly STEP_SIZE = 8;
  private readonly UPDATE_RATE = 60; // 60 FPS
  private readonly KEY_TIMEOUT = 100; // ms

  constructor(port: SerialPort, serialNumber: string) {
    this.port = new WebTeleoperationPort(port);
    this.motorConfigs = loadCalibrationConfig(serialNumber);
  }

  async initialize(): Promise<void> {
    await this.port.initialize();

    // Read current positions
    for (const config of this.motorConfigs) {
      const position = await this.port.readMotorPosition(config.id);
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
  }

  async disconnect(): Promise<void> {
    this.stop();
    await this.port.disconnect();
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
      const control = KEYBOARD_CONTROLS[key as keyof typeof KEYBOARD_CONTROLS];
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
        this.port
          .writeMotorPosition(motorConfig.id, Math.round(targetPosition))
          .then((success) => {
            if (success) {
              motorConfig.currentPosition = targetPosition;
            }
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

    const success = await this.port.writeMotorPosition(
      motorConfig.id,
      Math.round(clampedPosition)
    );
    if (success) {
      motorConfig.currentPosition = clampedPosition;
    }

    return success;
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

  async goToHomePosition(): Promise<boolean> {
    const homePositions = this.motorConfigs.reduce((acc, config) => {
      acc[config.name] = config.homePosition;
      return acc;
    }, {} as { [motorName: string]: number });

    return this.setMotorPositions(homePositions);
  }
}

/**
 * Create teleoperation controller for connected robot
 */
export async function createWebTeleoperationController(
  port: SerialPort,
  serialNumber: string
): Promise<WebTeleoperationController> {
  const controller = new WebTeleoperationController(port, serialNumber);
  await controller.initialize();
  return controller;
}

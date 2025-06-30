/**
 * Base Robot class for Node.js platform
 * Uses serialport package for serial communication
 * Mirrors Python lerobot/common/robots/robot.py
 */

import { SerialPort } from "serialport";
import { mkdir, writeFile } from "fs/promises";
import { existsSync, readFileSync, mkdirSync } from "fs";
import { join } from "path";
import type { RobotConfig } from "../types/robot-config.js";
import { getCalibrationDir, ROBOTS } from "../utils/constants.js";

export abstract class Robot {
  protected port: SerialPort | null = null;
  protected config: RobotConfig;
  protected calibrationDir: string;
  protected calibrationPath: string;
  protected name: string;
  protected calibration: any = {}; // Loaded calibration data
  protected isCalibrated: boolean = false;

  constructor(config: RobotConfig) {
    this.config = config;
    this.name = config.type;

    // Determine calibration directory
    // Mirrors Python: config.calibration_dir if config.calibration_dir else HF_LEROBOT_CALIBRATION / ROBOTS / self.name
    this.calibrationDir =
      config.calibration_dir || join(getCalibrationDir(), ROBOTS, this.name);

    // Use robot ID or type as filename
    const robotId = config.id || this.name;
    this.calibrationPath = join(this.calibrationDir, `${robotId}.json`);

    // Auto-load calibration if it exists (like Python version)
    this.loadCalibration();
  }

  /**
   * Connect to the robot
   * Mirrors Python robot.connect()
   */
  async connect(_calibrate: boolean = false): Promise<void> {
    try {
      this.port = new SerialPort({
        path: this.config.port,
        baudRate: 1000000, // Default baud rate for Feetech motors (SO-100) - matches Python lerobot
        dataBits: 8, // 8 data bits - matches Python serial.EIGHTBITS
        stopBits: 1, // 1 stop bit - matches Python default
        parity: "none", // No parity - matches Python default
        autoOpen: false,
      });

      // Open the port
      await new Promise<void>((resolve, reject) => {
        this.port!.open((error) => {
          if (error) {
            reject(
              new Error(
                `Failed to open port ${this.config.port}: ${error.message}`
              )
            );
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error(`Could not connect to robot on port ${this.config.port}`);
    }
  }

  /**
   * Calibrate the robot
   * Must be implemented by subclasses
   */
  abstract calibrate(): Promise<void>;

  /**
   * Disconnect from the robot
   * Mirrors Python robot.disconnect()
   */
  async disconnect(): Promise<void> {
    if (this.port && this.port.isOpen) {
      // Handle torque disable if configured
      if (this.config.disable_torque_on_disconnect) {
        await this.disableTorque();
      }

      await new Promise<void>((resolve) => {
        this.port!.close(() => {
          resolve();
        });
      });

      this.port = null;
    }
  }

  /**
   * Save calibration data to JSON file
   * Mirrors Python's configuration saving
   */
  protected async saveCalibration(calibrationData: any): Promise<void> {
    // Ensure calibration directory exists
    try {
      mkdirSync(this.calibrationDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, that's fine
    }

    // Save calibration data as JSON
    await writeFile(
      this.calibrationPath,
      JSON.stringify(calibrationData, null, 2)
    );

    console.log(`Configuration saved to: ${this.calibrationPath}`);
  }

  /**
   * Load calibration data from JSON file
   * Mirrors Python's _load_calibration()
   */
  protected loadCalibration(): void {
    try {
      if (existsSync(this.calibrationPath)) {
        const calibrationData = readFileSync(this.calibrationPath, "utf8");
        this.calibration = JSON.parse(calibrationData);
        this.isCalibrated = true;
        console.log(`✅ Loaded calibration from: ${this.calibrationPath}`);
      } else {
        console.log(
          `⚠️  No calibration file found at: ${this.calibrationPath}`
        );
        this.isCalibrated = false;
      }
    } catch (error) {
      console.warn(
        `Failed to load calibration: ${
          error instanceof Error ? error.message : error
        }`
      );
      this.calibration = {};
      this.isCalibrated = false;
    }
  }

  /**
   * Send command to robot via serial port
   */
  protected async sendCommand(command: string): Promise<void> {
    if (!this.port || !this.port.isOpen) {
      throw new Error("Robot not connected");
    }

    return new Promise<void>((resolve, reject) => {
      this.port!.write(command, (error) => {
        if (error) {
          reject(new Error(`Failed to send command: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Read data from robot
   */
  protected async readData(timeout: number = 5000): Promise<Buffer> {
    if (!this.port || !this.port.isOpen) {
      throw new Error("Robot not connected");
    }

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Read timeout"));
      }, timeout);

      this.port!.once("data", (data: Buffer) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  /**
   * Disable torque on disconnect (SO-100 specific)
   */
  protected async disableTorque(): Promise<void> {
    try {
      await this.sendCommand("TORQUE_DISABLE\r\n");
    } catch (error) {
      console.warn("Warning: Could not disable torque on disconnect");
    }
  }
}

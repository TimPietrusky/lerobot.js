/**
 * Base Robot class for Node.js platform
 * Uses serialport package for serial communication
 * Mirrors Python lerobot/common/robots/robot.py
 */

import { SerialPort } from "serialport";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import type { RobotConfig } from "./config.js";
import { getCalibrationDir, ROBOTS } from "../constants.js";

export abstract class Robot {
  protected port: SerialPort | null = null;
  protected config: RobotConfig;
  protected calibrationDir: string;
  protected calibrationPath: string;
  protected name: string;

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
    await mkdir(this.calibrationDir, { recursive: true });

    // Save calibration data as JSON
    await writeFile(
      this.calibrationPath,
      JSON.stringify(calibrationData, null, 2)
    );

    console.log(`Configuration saved to: ${this.calibrationPath}`);
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

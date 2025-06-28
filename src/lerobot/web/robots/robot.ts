/**
 * Base Robot class for Web platform
 * Uses Web Serial API for serial communication
 */

import type { RobotConfig } from "../../node/robots/config.js";

// Web Serial API type declarations (minimal for our needs)
declare global {
  interface SerialPort {
    open(options: { baudRate: number }): Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
  }
}

export abstract class Robot {
  protected port: SerialPort | null = null;
  protected config: RobotConfig;
  protected name: string;
  protected reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  protected writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  constructor(config: RobotConfig) {
    this.config = config;
    this.name = config.type;
  }

  /**
   * Connect to the robot using Web Serial API
   * Requires user interaction to select port
   */
  async connect(_calibrate: boolean = false): Promise<void> {
    try {
      // Request port from user (requires user interaction)
      this.port = await navigator.serial.requestPort();

      // Open the port with correct SO-100 baudRate
      await this.port.open({ baudRate: 1000000 }); // Correct baudRate for Feetech motors (SO-100)

      // Set up readable and writable streams
      if (this.port.readable) {
        this.reader = this.port.readable.getReader();
      }

      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }
    } catch (error) {
      throw new Error(
        `Could not connect to robot: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  /**
   * Calibrate the robot
   * Must be implemented by subclasses
   */
  abstract calibrate(): Promise<void>;

  /**
   * Disconnect from the robot
   */
  async disconnect(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
      this.reader.releaseLock();
      this.reader = null;
    }

    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  /**
   * Save calibration data to browser storage
   * Uses localStorage as fallback, IndexedDB preferred for larger data
   */
  protected async saveCalibration(calibrationData: any): Promise<void> {
    const robotId = this.config.id || this.name;
    const key = `lerobot_calibration_${this.name}_${robotId}`;

    try {
      // Save to localStorage for now (could be enhanced to use File System Access API)
      localStorage.setItem(key, JSON.stringify(calibrationData));

      // Optionally trigger download
      this.downloadCalibration(calibrationData, robotId);

      console.log(`Configuration saved to browser storage and downloaded.`);
    } catch (error) {
      this.downloadCalibration(calibrationData, robotId);
      console.log(`Configuration downloaded as file.`);
    }
  }

  /**
   * Download calibration data as JSON file
   */
  private downloadCalibration(calibrationData: any, robotId: string): void {
    const dataStr = JSON.stringify(calibrationData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${robotId}_calibration.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Send command to robot via Web Serial API
   */
  protected async sendCommand(command: string): Promise<void> {
    if (!this.writer) {
      throw new Error("Robot not connected");
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(command);
    await this.writer.write(data);
  }

  /**
   * Read data from robot with timeout
   */
  protected async readData(timeout: number = 5000): Promise<Uint8Array> {
    if (!this.reader) {
      throw new Error("Robot not connected");
    }

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Read timeout")), timeout);
    });

    const readPromise = this.reader.read().then((result) => {
      if (result.done) {
        throw new Error("Stream closed");
      }
      return result.value;
    });

    return Promise.race([readPromise, timeoutPromise]);
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

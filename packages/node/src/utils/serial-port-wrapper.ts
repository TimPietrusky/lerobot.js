/**
 * Node.js Serial Port Wrapper
 * Standardized serialport API interface with write/read operations
 */

import { SerialPort } from "serialport";

/**
 * Node.js Serial Port wrapper - provides write/read interface similar to web version
 */
export class NodeSerialPortWrapper {
  private port: SerialPort;
  private isConnected: boolean = false;
  public readonly path: string; // Expose path for releaseMotors compatibility

  // Expose underlying port for OLD WORKING approach compatibility
  public get underlyingPort(): SerialPort {
    return this.port;
  }

  constructor(path: string, options: any = {}) {
    this.path = path;
    this.port = new SerialPort({
      path,
      baudRate: options.baudRate || 1000000,
      dataBits: options.dataBits || 8,
      parity: options.parity || "none",
      stopBits: options.stopBits || 1,
      autoOpen: false,
    });
  }

  get isOpen(): boolean {
    return this.isConnected && this.port.isOpen;
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(new Error(`Failed to open port: ${err.message}`));
        } else {
          this.isConnected = true;
          resolve();
        }
      });
    });
  }

  // Add open method to match SerialPort interface
  async open(): Promise<void> {
    return this.initialize();
  }

  async write(data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("Port not open for writing"));
        return;
      }

      this.port.write(Buffer.from(data), (err) => {
        if (err) {
          reject(new Error(`Write failed: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async read(timeout: number = 1000): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error("Port not open for reading"));
        return;
      }

      const timeoutId = setTimeout(() => {
        reject(new Error("Read timeout"));
      }, timeout);

      const onData = (data: Buffer) => {
        clearTimeout(timeoutId);
        this.port.removeListener("data", onData);
        resolve(data); // Return Buffer directly to match interface
      };

      this.port.once("data", onData);
    });
  }

  async writeAndRead(
    data: Uint8Array,
    timeout: number = 1000
  ): Promise<Uint8Array> {
    await this.write(data);

    // Wait for motor response (motors need time to process command)
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await this.read(timeout);
    return response ? new Uint8Array(response) : new Uint8Array();
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isConnected && this.port.isOpen) {
        this.port.close(() => {
          this.isConnected = false;
          resolve();
        });
      } else {
        this.isConnected = false;
        resolve();
      }
    });
  }
}

/**
 * Web Serial Port Wrapper
 * Standardized Web Serial API interface with immediate lock release
 */

import type { SerialPort } from "../types/robot-connection.js";

/**
 * Web Serial Port wrapper - direct write/read with immediate lock release
 */
export class WebSerialPortWrapper {
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
      throw new Error("Port is not open for reading/writing");
    }
  }

  async write(data: Uint8Array): Promise<void> {
    if (!this.port.writable) {
      throw new Error("Port not open for writing");
    }

    const writer = this.port.writable.getWriter();
    try {
      await writer.write(data);
    } finally {
      writer.releaseLock();
    }
  }

  async read(timeout: number = 1000): Promise<Uint8Array> {
    if (!this.port.readable) {
      throw new Error("Port not open for reading");
    }

    const reader = this.port.readable.getReader();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Read timeout")), timeout);
      });

      const result = await Promise.race([reader.read(), timeoutPromise]);
      const { value, done } = result;

      if (done || !value) {
        throw new Error("Read failed - port closed or no data");
      }

      return new Uint8Array(value);
    } finally {
      reader.releaseLock();
    }
  }

  async close(): Promise<void> {
    // Don't close the port itself - just wrapper cleanup
  }
}

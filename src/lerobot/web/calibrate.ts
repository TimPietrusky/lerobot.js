/**
 * Web calibration functionality using Web Serial API
 * For browser environments - matches Node.js implementation
 */

import type { CalibrateConfig } from "../node/robots/config.js";

/**
 * Web Serial Port wrapper to match Node.js SerialPort interface
 */
class WebSerialPortWrapper {
  private port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

  constructor(port: SerialPort) {
    this.port = port;
  }

  get isOpen(): boolean {
    return this.port !== null && this.port.readable !== null;
  }

  async initialize(): Promise<void> {
    // Set up reader and writer for already opened port
    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }
  }

  async write(data: Buffer): Promise<void> {
    if (!this.writer) {
      throw new Error("Port not open for writing");
    }
    await this.writer.write(new Uint8Array(data));
  }

  async read(timeout: number = 5000): Promise<Buffer> {
    if (!this.reader) {
      throw new Error("Port not open for reading");
    }

    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Read timeout"));
      }, timeout);

      this.reader!.read()
        .then(({ value, done }) => {
          clearTimeout(timer);
          if (done || !value) {
            reject(new Error("Read failed"));
          } else {
            resolve(Buffer.from(value));
          }
        })
        .catch(reject);
    });
  }

  async close(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.writer) {
      this.writer.releaseLock();
      this.writer = null;
    }
    // Don't close the port itself - let the UI manage that
  }
}

/**
 * SO-100 calibration configuration for web
 */
interface WebSO100CalibrationConfig {
  deviceType: "so100_follower" | "so100_leader";
  port: WebSerialPortWrapper;
  motorNames: string[];
  driveModes: number[];
  calibModes: string[];
  limits: {
    position_min: number[];
    position_max: number[];
    velocity_max: number[];
    torque_max: number[];
  };
}

/**
 * Read motor positions using Web Serial API
 */
async function readMotorPositions(
  config: WebSO100CalibrationConfig
): Promise<number[]> {
  const motorPositions: number[] = [];
  const motorIds = [1, 2, 3, 4, 5, 6]; // SO-100 uses servo IDs 1-6

  for (let i = 0; i < motorIds.length; i++) {
    const motorId = motorIds[i];

    try {
      // Create STS3215 Read Position packet
      const packet = Buffer.from([
        0xff,
        0xff,
        motorId,
        0x04,
        0x02,
        0x38,
        0x02,
        0x00,
      ]);
      const checksum = ~(motorId + 0x04 + 0x02 + 0x38 + 0x02) & 0xff;
      packet[7] = checksum;

      await config.port.write(packet);

      try {
        const response = await config.port.read(100);
        if (response.length >= 7) {
          const id = response[2];
          const error = response[4];
          if (id === motorId && error === 0) {
            const position = response[5] | (response[6] << 8);
            motorPositions.push(position);
          } else {
            motorPositions.push(2047); // Fallback to center
          }
        } else {
          motorPositions.push(2047);
        }
      } catch (readError) {
        motorPositions.push(2047);
      }
    } catch (error) {
      motorPositions.push(2047);
    }

    // Minimal delay between servo reads
    await new Promise((resolve) => setTimeout(resolve, 2));
  }

  return motorPositions;
}

/**
 * Interactive web calibration with live updates
 */
async function performWebCalibration(
  config: WebSO100CalibrationConfig
): Promise<any> {
  // Step 1: Set homing position
  alert(
    `📍 STEP 1: Set Homing Position\n\nMove the SO-100 ${config.deviceType} to the MIDDLE of its range of motion and click OK...`
  );

  const currentPositions = await readMotorPositions(config);
  const homingOffsets: { [motor: string]: number } = {};
  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = currentPositions[i];
    const maxRes = 4095; // STS3215 resolution
    homingOffsets[motorName] = position - Math.floor(maxRes / 2);
  }

  // Step 2: Record ranges with simplified interface for web
  alert(
    `📏 STEP 2: Record Joint Ranges\n\nMove all joints through their full range of motion, then click OK when finished...`
  );

  const rangeMins: { [motor: string]: number } = {};
  const rangeMaxes: { [motor: string]: number } = {};

  // Initialize with current positions
  const initialPositions = await readMotorPositions(config);
  for (let i = 0; i < config.motorNames.length; i++) {
    const motorName = config.motorNames[i];
    const position = initialPositions[i];
    rangeMins[motorName] = position;
    rangeMaxes[motorName] = position;
  }

  // Record positions for a brief period
  const recordingDuration = 10000; // 10 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < recordingDuration) {
    const positions = await readMotorPositions(config);

    for (let i = 0; i < config.motorNames.length; i++) {
      const motorName = config.motorNames[i];
      const position = positions[i];

      if (position < rangeMins[motorName]) {
        rangeMins[motorName] = position;
      }
      if (position > rangeMaxes[motorName]) {
        rangeMaxes[motorName] = position;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return {
    homing_offset: config.motorNames.map((name) => homingOffsets[name]),
    drive_mode: config.driveModes,
    start_pos: config.motorNames.map((name) => rangeMins[name]),
    end_pos: config.motorNames.map((name) => rangeMaxes[name]),
    calib_mode: config.calibModes,
    motor_names: config.motorNames,
  };
}

/**
 * Calibrate a device using an already connected port
 */
export async function calibrateWithPort(
  armType: "so100_follower" | "so100_leader",
  armId: string,
  connectedPort: SerialPort
): Promise<void> {
  try {
    // Create web serial port wrapper
    const port = new WebSerialPortWrapper(connectedPort);
    await port.initialize();

    // Get SO-100 calibration configuration
    const so100Config: WebSO100CalibrationConfig = {
      deviceType: armType,
      port,
      motorNames: [
        "shoulder_pan",
        "shoulder_lift",
        "elbow_flex",
        "wrist_flex",
        "wrist_roll",
        "gripper",
      ],
      driveModes: [0, 0, 0, 0, 0, 0],
      calibModes: [
        "position",
        "position",
        "position",
        "position",
        "position",
        "position",
      ],
      limits: {
        position_min: [0, 0, 0, 0, 0, 0],
        position_max: [4095, 4095, 4095, 4095, 4095, 4095],
        velocity_max: [100, 100, 100, 100, 100, 100],
        torque_max: [50, 50, 50, 50, 25, 25],
      },
    };

    // Perform calibration
    const calibrationResults = await performWebCalibration(so100Config);

    // Save to browser storage and download
    const calibrationData = {
      ...calibrationResults,
      device_type: armType,
      device_id: armId,
      calibrated_at: new Date().toISOString(),
      platform: "web",
      api: "Web Serial API",
    };

    const storageKey = `lerobot_calibration_${armType}_${armId}`;
    localStorage.setItem(storageKey, JSON.stringify(calibrationData));

    // Download calibration file
    downloadCalibrationFile(calibrationData, armId);

    // Close wrapper (but not the underlying port)
    await port.close();

    console.log(`Configuration saved to browser storage and downloaded.`);
  } catch (error) {
    throw new Error(
      `Web calibration failed: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Calibrate a device in the browser using Web Serial API
 * Must be called from user interaction (button click)
 * This version requests a new port - use calibrateWithPort for already connected ports
 */
export async function calibrate(config: CalibrateConfig): Promise<void> {
  // Validate Web Serial API support
  if (!("serial" in navigator)) {
    throw new Error("Web Serial API not supported in this browser");
  }

  // Validate configuration
  if (Boolean(config.robot) === Boolean(config.teleop)) {
    throw new Error("Choose either a robot or a teleop.");
  }

  const deviceConfig = config.robot || config.teleop!;

  try {
    // Request a new port for this calibration
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 1000000 });

    // Use the new port calibration function
    await calibrateWithPort(
      deviceConfig.type as "so100_follower" | "so100_leader",
      deviceConfig.id || deviceConfig.type,
      port
    );

    // Close the port we opened
    await port.close();
  } catch (error) {
    throw new Error(
      `Web calibration failed: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Download calibration data as JSON file
 */
function downloadCalibrationFile(calibrationData: any, deviceId: string): void {
  const dataStr = JSON.stringify(calibrationData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });

  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${deviceId}_calibration.json`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Check if Web Serial API is supported
 */
export function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

/**
 * Create a calibration button for web interface
 * Returns a button element that when clicked starts calibration
 */
export function createCalibrateButton(
  config: CalibrateConfig
): HTMLButtonElement {
  const button = document.createElement("button");
  button.textContent = "Calibrate Device";
  button.style.cssText = `
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 16px;
  `;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Calibrating...";

    try {
      await calibrate(config);
      button.textContent = "Calibration Complete!";
      button.style.backgroundColor = "#28a745";
    } catch (error) {
      button.textContent = "Calibration Failed";
      button.style.backgroundColor = "#dc3545";
      console.error("Calibration error:", error);
      alert(
        `Calibration failed: ${error instanceof Error ? error.message : error}`
      );
    } finally {
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "Calibrate Device";
        button.style.backgroundColor = "#007bff";
      }, 3000);
    }
  });

  return button;
}

/**
 * Node.js port discovery using serialport API
 * Provides programmatic port discovery compatible with @lerobot/web API
 */

import { SerialPort } from "serialport";
import { platform } from "os";
import { readdir } from "fs/promises";
import { join } from "path";
import { NodeSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import type {
  FindPortConfig,
  FindPortProcess,
  RobotConnection,
} from "./types/port-discovery.js";

/**
 * Find available serial ports on the system
 * Mirrors Python's find_available_ports() function
 * Exported for CLI usage
 */
export async function findAvailablePorts(): Promise<string[]> {
  if (platform() === "win32") {
    // List COM ports using serialport library (equivalent to pyserial)
    const ports = await SerialPort.list();
    return ports.map((port) => port.path);
  } else {
    // List /dev/tty* ports for Unix-based systems (Linux/macOS)
    try {
      const devFiles = await readdir("/dev");
      const ttyPorts = devFiles
        .filter((file) => file.startsWith("tty"))
        .map((file) => join("/dev", file));
      return ttyPorts;
    } catch (error) {
      // Fallback to serialport library if /dev reading fails
      const ports = await SerialPort.list();
      return ports.map((port) => port.path);
    }
  }
}

/**
 * Connect directly to a robot port (Python lerobot compatible)
 * Equivalent to robot.connect() in Python lerobot
 */
export async function connectPort(portPath: string): Promise<RobotConnection> {
  // Test connection
  const port = new NodeSerialPortWrapper(portPath);
  let isConnected = false;

  try {
    await port.initialize();
    isConnected = true;
    await port.close();
  } catch (error) {
    // Connection failed
  }

  // Return the ACTUAL working port, properly initialized!
  const workingPort = new NodeSerialPortWrapper(portPath);

  // Initialize the working port if connection test succeeded
  if (isConnected) {
    try {
      await workingPort.initialize();
    } catch (error) {
      isConnected = false;
    }
  }

  return {
    port: workingPort, // ← Return the initialized working port!
    name: `Robot on ${portPath}`,
    isConnected,
    serialNumber: portPath, // Use port path as serial number for Node.js
    error: isConnected ? undefined : "Connection failed",
  };
}

/**
 * Interactive mode: Return first available robot port
 * Similar to web's interactive mode but for Node.js
 */
async function findPortInteractive(
  options: FindPortConfig
): Promise<RobotConnection[]> {
  const { onMessage } = options;

  onMessage?.("🔍 Searching for available robot ports...");

  // Get all available ports
  const availablePorts = await findAvailablePorts();

  if (availablePorts.length === 0) {
    throw new Error("No serial ports found");
  }

  onMessage?.(
    `Found ${availablePorts.length} port(s), testing first available...`
  );

  // Try to connect to the first available port
  const firstPort = availablePorts[0];
  const connection = await connectPort(firstPort);

  if (connection.isConnected) {
    onMessage?.(`✅ Connected to robot on ${firstPort}`);
  } else {
    onMessage?.(`⚠️ Port ${firstPort} found but connection failed`);
  }

  // Return single robot in array (consistent with web API)
  return [
    {
      ...connection,
      robotType: "so100_follower", // Default, user can configure
      robotId: "discovered_robot",
    },
  ];
}

/**
 * Auto-connect mode: Connect to robots by serial number/port path
 * Returns all connection attempts (successful and failed)
 */
async function findPortAutoConnect(
  robotConfigs: NonNullable<FindPortConfig["robotConfigs"]>,
  options: FindPortConfig
): Promise<RobotConnection[]> {
  const { onMessage } = options;
  const results: RobotConnection[] = [];

  onMessage?.(`🔍 Auto-connecting to ${robotConfigs.length} robot(s)...`);

  for (const config of robotConfigs) {
    try {
      onMessage?.(
        `Connecting to ${config.robotId} (${config.serialNumber})...`
      );

      // Use serialNumber as port path for Node.js
      const connection = await connectPort(config.serialNumber);

      if (connection.isConnected) {
        onMessage?.(`✅ Connected to ${config.robotId}`);
        results.push({
          ...connection,
          robotType: config.robotType,
          robotId: config.robotId,
          serialNumber: config.serialNumber,
        });
      } else {
        onMessage?.(`❌ Failed to connect to ${config.robotId}`);
        results.push({
          ...connection,
          robotType: config.robotType,
          robotId: config.robotId,
          serialNumber: config.serialNumber,
          isConnected: false,
          error: connection.error || "Connection failed",
        });
      }
    } catch (error) {
      onMessage?.(
        `❌ Error connecting to ${config.robotId}: ${
          error instanceof Error ? error.message : error
        }`
      );
      results.push({
        port: {
          path: config.serialNumber,
          write: async () => {},
          read: async () => null,
          open: async () => {},
          close: async () => {},
          isOpen: false,
        },
        name: `Failed: ${config.robotId}`,
        isConnected: false,
        robotType: config.robotType,
        robotId: config.robotId,
        serialNumber: config.serialNumber,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const successCount = results.filter((r) => r.isConnected).length;
  onMessage?.(
    `🎯 Connected to ${successCount}/${robotConfigs.length} robot(s)`
  );

  return results;
}

/**
 * Main findPort function - web-compatible API
 *
 * Mode 1: Interactive (default) - Returns first available robot port
 * Mode 2: Auto-connect - Connects to pre-configured robots by port path
 */
export async function findPort(
  config: FindPortConfig = {}
): Promise<FindPortProcess> {
  const { robotConfigs, onMessage } = config;
  let stopped = false;

  // Determine mode
  const isAutoConnectMode = robotConfigs && robotConfigs.length > 0;

  onMessage?.(
    `🤖 ${
      isAutoConnectMode ? "Auto-connect" : "Interactive"
    } port discovery started`
  );

  // Create result promise
  const resultPromise = (async () => {
    if (stopped) {
      throw new Error("Port discovery was stopped");
    }

    if (isAutoConnectMode) {
      return await findPortAutoConnect(robotConfigs!, config);
    } else {
      return await findPortInteractive(config);
    }
  })();

  // Return process object (web-compatible API)
  return {
    result: resultPromise,
    stop: () => {
      stopped = true;
      onMessage?.("🛑 Port discovery stopped");
    },
  };
}

/**
 * Interactive port detection for CLI usage only
 * Matches Python lerobot's unplug/replug cable detection exactly
 * This function should only be used by the CLI, not the library
 */
export async function detectPortInteractive(
  onMessage?: (message: string) => void
): Promise<string> {
  const { createInterface } = await import("readline");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function waitForInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        resolve(answer);
      });
    });
  }

  try {
    const message = "Finding all available ports for the MotorsBus.";
    if (onMessage) onMessage(message);
    else console.log(message);

    // Get initial port list
    const portsBefore = await findAvailablePorts();

    const disconnectPrompt =
      "Remove the USB cable from your MotorsBus and press Enter when done.";
    await waitForInput(disconnectPrompt);

    // Get port list after disconnect
    const portsAfter = await findAvailablePorts();

    // Find the difference
    const portsDiff = portsBefore.filter((port) => !portsAfter.includes(port));

    if (portsDiff.length === 1) {
      const detectedPort = portsDiff[0];
      const successMessage = `Detected port: ${detectedPort}`;
      if (onMessage) onMessage(successMessage);
      else console.log(successMessage);

      const reconnectPrompt =
        "Reconnect the USB cable to your MotorsBus and press Enter when done.";
      await waitForInput(reconnectPrompt);

      // Verify the port is back
      const portsReconnected = await findAvailablePorts();
      if (portsReconnected.includes(detectedPort)) {
        const verifyMessage = `Verified port: ${detectedPort}`;
        if (onMessage) onMessage(verifyMessage);
        else console.log(verifyMessage);
        return detectedPort;
      } else {
        throw new Error("Port not found after reconnection");
      }
    } else if (portsDiff.length === 0) {
      throw new Error(
        "No port difference detected. Please check cable connection."
      );
    } else {
      throw new Error(
        `Multiple ports detected: ${portsDiff.join(
          ", "
        )}. Please disconnect other devices.`
      );
    }
  } finally {
    rl.close();
  }
}

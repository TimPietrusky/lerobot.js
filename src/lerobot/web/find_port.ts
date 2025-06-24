/**
 * Browser implementation of find_port using WebSerial API
 * Clean API with native dialogs and auto-connect modes
 *
 * Usage Examples:
 *
 * // Interactive mode - always returns array
 * const findProcess = await findPort();
 * const robotConnections = await findProcess.result;
 * const robot = robotConnections[0]; // First (and only) robot
 * await calibrate(robot, options);
 *
 * // Auto-connect mode - returns array of all attempted connections
 * const findProcess = await findPort({
 *   robotConfigs: [
 *     { robotType: "so100_follower", robotId: "arm1", serialNumber: "ABC123" },
 *     { robotType: "so100_leader", robotId: "arm2", serialNumber: "DEF456" }
 *   ]
 * });
 * const robotConnections = await findProcess.result;
 * for (const robot of robotConnections.filter(r => r.isConnected)) {
 *   await calibrate(robot, options);
 * }
 *
 * // Store/load from localStorage
 * localStorage.setItem('myRobots', JSON.stringify(robotConnections));
 * const storedRobots = JSON.parse(localStorage.getItem('myRobots'));
 * await calibrate(storedRobots[0], options);
 */

import { getRobotConnectionManager } from "./robot-connection.js";
import type {
  RobotConnection,
  RobotConfig,
  SerialPort,
} from "./types/robot-connection.js";

/**
 * Extended WebSerial API type definitions
 */
interface Serial extends EventTarget {
  getPorts(): Promise<SerialPort[]>;
  requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

interface SerialPortRequestOptions {
  filters?: SerialPortFilter[];
}

interface SerialPortFilter {
  usbVendorId?: number;
  usbProductId?: number;
}

declare global {
  interface Navigator {
    serial: Serial;
  }
}

/**
 * Options for findPort function
 */
export interface FindPortOptions {
  // Auto-connect mode: provide robot configs to connect to
  robotConfigs?: RobotConfig[];

  // Callbacks
  onMessage?: (message: string) => void;
  onRequestUserAction?: (
    message: string,
    type: "confirm" | "select"
  ) => Promise<boolean>;
}

/**
 * Process object returned by findPort
 */
export interface FindPortProcess {
  // Result promise - Always returns RobotConnection[] (consistent API)
  // Interactive mode: single robot in array
  // Auto-connect mode: all successfully connected robots in array
  result: Promise<RobotConnection[]>;

  // Control
  stop: () => void;
}

/**
 * Check if WebSerial API is available
 */
function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

/**
 * Get display name for a port
 */
function getPortDisplayName(port: SerialPort): string {
  const info = port.getInfo();
  if (info.usbVendorId && info.usbProductId) {
    return `USB Device (${info.usbVendorId}:${info.usbProductId})`;
  }
  return "Serial Device";
}

/**
 * Try to get serial number from a port by opening and reading device info
 */
async function getPortSerialNumber(port: SerialPort): Promise<string | null> {
  try {
    const wasOpen = port.readable !== null;

    // Open port if not already open
    if (!wasOpen) {
      await port.open({ baudRate: 1000000 });
    }

    // For now, we'll return null since reading serial number from STS3215 motors
    // requires specific protocol implementation. This is a placeholder for future enhancement.
    // In practice, serial numbers are typically stored in device metadata or configuration.

    // Close port if we opened it
    if (!wasOpen && port.readable) {
      await port.close();
    }

    return null;
  } catch (error) {
    console.warn("Could not read serial number from port:", error);
    return null;
  }
}

/**
 * Interactive mode: Show native dialog for port selection
 */
async function findPortInteractive(
  options: FindPortOptions
): Promise<RobotConnection[]> {
  const { onMessage } = options;

  onMessage?.("Opening port selection dialog...");

  try {
    // Use native browser dialog - much better UX than port diffing!
    const port = await navigator.serial.requestPort();

    // Open the port
    await port.open({ baudRate: 1000000 });

    const portName = getPortDisplayName(port);
    onMessage?.(`✅ Connected to ${portName}`);

    // Return unified RobotConnection object in array (consistent API)
    // In interactive mode, user will need to specify robot details separately
    return [
      {
        port,
        name: portName,
        isConnected: true,
        robotType: "so100_follower", // Default, user can change
        robotId: "interactive_robot",
        serialNumber: `interactive_${Date.now()}`,
      },
    ];
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") || error.name === "NotAllowedError")
    ) {
      throw new Error("Port selection cancelled by user");
    }
    throw new Error(
      `Failed to select port: ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * Auto-connect mode: Connect to robots by serial number
 * Returns all successfully connected robots
 */
async function findPortAutoConnect(
  robotConfigs: RobotConfig[],
  options: FindPortOptions
): Promise<RobotConnection[]> {
  const { onMessage } = options;
  const results: RobotConnection[] = [];

  onMessage?.(`🔍 Auto-connecting to ${robotConfigs.length} robot(s)...`);

  // Get all available ports
  const availablePorts = await navigator.serial.getPorts();
  onMessage?.(`Found ${availablePorts.length} available port(s)`);

  for (const config of robotConfigs) {
    onMessage?.(`Connecting to ${config.robotId} (${config.serialNumber})...`);

    let connected = false;
    let matchedPort: SerialPort | null = null;
    let error: string | undefined;

    try {
      // For now, we'll try each available port and see if we can connect
      // In a future enhancement, we could match by actual serial number reading
      for (const port of availablePorts) {
        try {
          // Try to open and use this port
          const wasOpen = port.readable !== null;
          if (!wasOpen) {
            await port.open({ baudRate: 1000000 });
          }

          // Test connection by trying to communicate
          const manager = getRobotConnectionManager();
          await manager.connect(
            port,
            config.robotType,
            config.robotId,
            config.serialNumber
          );

          matchedPort = port;
          connected = true;
          onMessage?.(`✅ Connected to ${config.robotId}`);
          break;
        } catch (portError) {
          // This port didn't work, try next one
          console.log(
            `Port ${getPortDisplayName(port)} didn't match ${config.robotId}:`,
            portError
          );
          continue;
        }
      }

      if (!connected) {
        error = `No matching port found for ${config.robotId} (${config.serialNumber})`;
        onMessage?.(`❌ ${error}`);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
      onMessage?.(`❌ Failed to connect to ${config.robotId}: ${error}`);
    }

    // Add result (successful or failed)
    results.push({
      port: matchedPort!,
      name: matchedPort ? getPortDisplayName(matchedPort) : "Unknown Port",
      isConnected: connected,
      robotType: config.robotType,
      robotId: config.robotId,
      serialNumber: config.serialNumber,
      error,
    });
  }

  const successCount = results.filter((r) => r.isConnected).length;
  onMessage?.(
    `🎯 Connected to ${successCount}/${robotConfigs.length} robot(s)`
  );

  return results;
}

/**
 * Main findPort function - clean API with Two modes:
 *
 * Mode 1: Interactive - Returns single RobotConnection
 * Mode 2: Auto-connect - Returns RobotConnection[]
 */
export async function findPort(
  options: FindPortOptions = {}
): Promise<FindPortProcess> {
  // Check WebSerial support
  if (!isWebSerialSupported()) {
    throw new Error(
      "WebSerial API not supported. Please use Chrome/Edge 89+ with HTTPS or localhost."
    );
  }

  const { robotConfigs, onMessage } = options;
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
      return await findPortAutoConnect(robotConfigs!, options);
    } else {
      return await findPortInteractive(options);
    }
  })();

  // Return process object
  return {
    result: resultPromise,
    stop: () => {
      stopped = true;
      onMessage?.("🛑 Port discovery stopped");
    },
  };
}

/**
 * Browser implementation of find_port using WebSerial + WebUSB APIs
 * WebSerial: Communication with device
 * WebUSB: Device identification and serial numbers
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

import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import { readMotorPosition } from "./utils/motor-communication.js";
import {
  isWebSerialSupported,
  isWebUSBSupported,
} from "./utils/browser-support.js";
import type {
  RobotConnection,
  RobotConfig,
  SerialPort,
} from "./types/robot-connection.js";
import type {
  Serial,
  FindPortOptions,
  FindPortProcess,
  USBDevice,
} from "./types/port-discovery.js";

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
 * Request USB device for metadata and serial number extraction
 */
async function requestUSBDeviceMetadata(): Promise<{
  serialNumber: string;
  usbMetadata: RobotConnection["usbMetadata"];
}> {
  try {
    // Request USB device access for metadata (no filters - accept any device)
    const usbDevice = await navigator.usb.requestDevice({
      filters: [], // No filtering - let user choose any device
    });

    const serialNumber =
      usbDevice.serialNumber ||
      `${usbDevice.vendorId}-${usbDevice.productId}-${Date.now()}`;

    const usbMetadata = {
      vendorId: `0x${usbDevice.vendorId.toString(16).padStart(4, "0")}`,
      productId: `0x${usbDevice.productId.toString(16).padStart(4, "0")}`,
      serialNumber: usbDevice.serialNumber || "Generated ID",
      manufacturerName: usbDevice.manufacturerName || "Unknown",
      productName: usbDevice.productName || "Unknown",
      usbVersionMajor: usbDevice.usbVersionMajor,
      usbVersionMinor: usbDevice.usbVersionMinor,
      deviceClass: usbDevice.deviceClass,
      deviceSubclass: usbDevice.deviceSubclass,
      deviceProtocol: usbDevice.deviceProtocol,
    };

    return { serialNumber, usbMetadata };
  } catch (usbError) {
    console.log("⚠️ WebUSB request failed, generating fallback ID:", usbError);
    // Generate a fallback unique ID if WebUSB fails
    const serialNumber = `fallback-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const usbMetadata = {
      vendorId: "Unknown",
      productId: "Unknown",
      serialNumber: serialNumber,
      manufacturerName: "WebUSB Not Available",
      productName: "Check browser WebUSB support",
    };

    return { serialNumber, usbMetadata };
  }
}

/**
 * Get USB device metadata for already permitted devices
 */
async function getStoredUSBDeviceMetadata(port: SerialPort): Promise<{
  serialNumber: string;
  usbMetadata?: RobotConnection["usbMetadata"];
}> {
  try {
    if (!isWebUSBSupported()) {
      throw new Error("WebUSB not supported");
    }

    // Get already permitted USB devices
    const usbDevices = await navigator.usb.getDevices();
    const portInfo = port.getInfo();

    // Try to find matching USB device by vendor/product ID
    const matchingDevice = usbDevices.find(
      (device) =>
        device.vendorId === portInfo.usbVendorId &&
        device.productId === portInfo.usbProductId
    );

    if (matchingDevice) {
      const serialNumber =
        matchingDevice.serialNumber ||
        `${matchingDevice.vendorId}-${matchingDevice.productId}-${Date.now()}`;

      const usbMetadata = {
        vendorId: `0x${matchingDevice.vendorId.toString(16).padStart(4, "0")}`,
        productId: `0x${matchingDevice.productId
          .toString(16)
          .padStart(4, "0")}`,
        serialNumber: matchingDevice.serialNumber || "Generated ID",
        manufacturerName: matchingDevice.manufacturerName || "Unknown",
        productName: matchingDevice.productName || "Unknown",
        usbVersionMajor: matchingDevice.usbVersionMajor,
        usbVersionMinor: matchingDevice.usbVersionMinor,
        deviceClass: matchingDevice.deviceClass,
        deviceSubclass: matchingDevice.deviceSubclass,
        deviceProtocol: matchingDevice.deviceProtocol,
      };

      console.log("✅ Restored USB metadata for port:", serialNumber);
      return { serialNumber, usbMetadata };
    }

    throw new Error("No matching USB device found");
  } catch (usbError) {
    console.log("⚠️ Could not restore USB metadata:", usbError);
    // Generate fallback if no USB metadata available
    const serialNumber = `fallback-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    return { serialNumber };
  }
}

/**
 * Interactive mode: Show native dialogs for port + device selection
 */
async function findPortInteractive(
  options: FindPortOptions
): Promise<RobotConnection[]> {
  const { onMessage } = options;

  onMessage?.("Opening port selection dialog...");

  try {
    // Step 1: Request Web Serial port
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 1000000 });

    const portName = getPortDisplayName(port);
    onMessage?.(`✅ Connected to ${portName}`);

    // Step 2: Request WebUSB device for metadata (if supported)
    let serialNumber: string;
    let usbMetadata: RobotConnection["usbMetadata"];

    if (isWebUSBSupported()) {
      onMessage?.("📱 Requesting device identification...");
      const usbData = await requestUSBDeviceMetadata();
      serialNumber = usbData.serialNumber;
      usbMetadata = usbData.usbMetadata;
      onMessage?.(`🆔 Device ID: ${serialNumber}`);
    } else {
      onMessage?.("⚠️ WebUSB not supported, using fallback ID");
      const fallbackId = `no-usb-${Date.now()}`;
      serialNumber = fallbackId;
      usbMetadata = {
        vendorId: "Unknown",
        productId: "Unknown",
        serialNumber: fallbackId,
        manufacturerName: "WebUSB Not Supported",
        productName: "Browser limitation",
      };
    }

    // Return unified RobotConnection object in array (consistent API)
    return [
      {
        port,
        name: portName,
        isConnected: true,
        robotType: "so100_follower", // Default, user can change
        robotId: "interactive_robot",
        serialNumber,
        usbMetadata,
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

  // For each available port, try to restore USB metadata and match with configs
  for (const port of availablePorts) {
    try {
      // Get USB device metadata for this port
      const { serialNumber, usbMetadata } = await getStoredUSBDeviceMetadata(
        port
      );

      // Find matching robot config by serial number
      const matchingConfig = robotConfigs.find(
        (config) => config.serialNumber === serialNumber
      );

      if (matchingConfig) {
        onMessage?.(
          `Connecting to ${matchingConfig.robotId} (${serialNumber})...`
        );

        try {
          // Try to open the port
          const wasOpen = port.readable !== null;
          if (!wasOpen) {
            await port.open({ baudRate: 1000000 });
          }

          // Test connection by trying basic motor communication
          const portWrapper = new WebSerialPortWrapper(port);
          await portWrapper.initialize();

          // Try to read from motor ID 1 (most robots have at least one motor)
          const testPosition = await readMotorPosition(portWrapper, 1);

          // If we can read a position, this is likely a working robot port
          if (testPosition !== null) {
            onMessage?.(`✅ Connected to ${matchingConfig.robotId}`);

            results.push({
              port,
              name: getPortDisplayName(port),
              isConnected: true,
              robotType: matchingConfig.robotType,
              robotId: matchingConfig.robotId,
              serialNumber,
              usbMetadata,
            });
          } else {
            throw new Error("No motor response - not a robot port");
          }
        } catch (connectionError) {
          onMessage?.(
            `❌ Failed to connect to ${matchingConfig.robotId}: ${
              connectionError instanceof Error
                ? connectionError.message
                : connectionError
            }`
          );

          results.push({
            port,
            name: getPortDisplayName(port),
            isConnected: false,
            robotType: matchingConfig.robotType,
            robotId: matchingConfig.robotId,
            serialNumber,
            usbMetadata,
            error:
              connectionError instanceof Error
                ? connectionError.message
                : "Unknown error",
          });
        }
      } else {
        console.log(
          `Port with serial ${serialNumber} not in requested configs, skipping`
        );
      }
    } catch (metadataError) {
      console.log(`Failed to get metadata for port:`, metadataError);
      // Skip this port if we can't get metadata
      continue;
    }
  }

  // Handle robots that weren't found
  for (const config of robotConfigs) {
    const found = results.some((r) => r.serialNumber === config.serialNumber);
    if (!found) {
      onMessage?.(
        `❌ Robot ${config.robotId} (${config.serialNumber}) not found`
      );
      results.push({
        port: null as any, // Will not be used since isConnected = false
        name: "Not Found",
        isConnected: false,
        robotType: config.robotType,
        robotId: config.robotId,
        serialNumber: config.serialNumber,
        error: `Device with serial number ${config.serialNumber} not found`,
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

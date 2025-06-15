/**
 * Helper to find the USB port associated with your MotorsBus.
 *
 * Direct port of Python lerobot find_port.py
 *
 * Example:
 * ```
 * npx lerobot find-port
 * ```
 */

import { SerialPort } from "serialport";
import { createInterface } from "readline";
import { platform } from "os";
import { readdir } from "fs/promises";
import { join } from "path";

/**
 * Find all available serial ports on the system
 * Mirrors Python's find_available_ports() function
 */
async function findAvailablePorts(): Promise<string[]> {
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
 * Create readline interface for user input
 * Equivalent to Python's input() function
 */
function createReadlineInterface() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input and wait for response
 * Equivalent to Python's input() function
 */
function waitForInput(prompt: string = ""): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    if (prompt) {
      process.stdout.write(prompt);
    }
    rl.on("line", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Sleep for specified milliseconds
 * Equivalent to Python's time.sleep()
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main find port function - direct port of Python find_port()
 * Maintains identical UX and messaging
 */
export async function findPort(): Promise<void> {
  console.log("Finding all available ports for the MotorsBus.");

  const portsBefore = await findAvailablePorts();
  console.log("Ports before disconnecting:", portsBefore);

  console.log(
    "Remove the USB cable from your MotorsBus and press Enter when done."
  );
  await waitForInput();

  // Allow some time for port to be released (equivalent to Python's time.sleep(0.5))
  await sleep(500);

  const portsAfter = await findAvailablePorts();
  const portsDiff = portsBefore.filter((port) => !portsAfter.includes(port));

  if (portsDiff.length === 1) {
    const port = portsDiff[0];
    console.log(`The port of this MotorsBus is '${port}'`);
    console.log("Reconnect the USB cable.");
  } else if (portsDiff.length === 0) {
    throw new Error(
      `Could not detect the port. No difference was found (${JSON.stringify(
        portsDiff
      )}).`
    );
  } else {
    throw new Error(
      `Could not detect the port. More than one port was found (${JSON.stringify(
        portsDiff
      )}).`
    );
  }
}

/**
 * CLI entry point when called directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  findPort().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

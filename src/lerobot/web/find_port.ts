/**
 * Browser implementation of find_port using WebSerial API
 *
 * Provides the same functionality as the Node.js version but adapted for browser environment
 * Uses WebSerial API for serial port detection and user interaction through DOM
 */

/**
 * Type definitions for WebSerial API (not yet in all TypeScript libs)
 */
interface SerialPort {
  readonly readable: ReadableStream;
  readonly writable: WritableStream;
  getInfo(): SerialPortInfo;
  open(options: SerialOptions): Promise<void>;
  close(): Promise<void>;
}

interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialOptions {
  baudRate: number;
  dataBits?: number;
  stopBits?: number;
  parity?: "none" | "even" | "odd";
}

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
 * Check if WebSerial API is available
 */
function isWebSerialSupported(): boolean {
  return "serial" in navigator;
}

/**
 * Get all available serial ports (requires user permission)
 * Browser equivalent of Node.js findAvailablePorts()
 */
async function findAvailablePortsWeb(): Promise<SerialPort[]> {
  if (!isWebSerialSupported()) {
    throw new Error(
      "WebSerial API not supported. Please use Chrome/Edge 89+ or Chrome Android 105+"
    );
  }

  try {
    return await navigator.serial.getPorts();
  } catch (error) {
    throw new Error(
      `Failed to get serial ports: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

/**
 * Format port info for display
 * Mimics the Node.js port listing format
 */
function formatPortInfo(ports: SerialPort[]): string[] {
  return ports.map((port, index) => {
    const info = port.getInfo();
    if (info.usbVendorId && info.usbProductId) {
      return `Port ${index + 1} (USB:${info.usbVendorId}:${info.usbProductId})`;
    }
    return `Port ${index + 1}`;
  });
}

/**
 * Sleep for specified milliseconds
 * Same as Node.js version
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for user interaction (button click or similar)
 * Browser equivalent of Node.js readline input()
 */
function waitForUserAction(message: string): Promise<void> {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const dialog = document.createElement("div");
    dialog.style.cssText = `
      background: white;
      padding: 2rem;
      border-radius: 8px;
      text-align: center;
      max-width: 500px;
      margin: 1rem;
    `;

    dialog.innerHTML = `
      <h3>Port Detection</h3>
      <p style="margin: 1rem 0;">${message}</p>
      <button id="continue-btn" style="
        background: #3498db;
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 1rem;
      ">Continue</button>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const continueBtn = dialog.querySelector(
      "#continue-btn"
    ) as HTMLButtonElement;
    continueBtn.addEventListener("click", () => {
      document.body.removeChild(modal);
      resolve();
    });
  });
}

/**
 * Request permission to access serial ports
 */
async function requestSerialPermission(
  logger: (message: string) => void
): Promise<void> {
  logger("Requesting permission to access serial ports...");
  logger(
    'Please select a serial device when prompted, or click "Cancel" if no devices are connected yet.'
  );

  try {
    // This will show the browser's serial port selection dialog
    await navigator.serial.requestPort();
    logger("✅ Permission granted to access serial ports.");
  } catch (error) {
    // User cancelled the dialog - this is OK, they might not have devices connected yet
    console.log("Permission dialog cancelled:", error);
  }
}

/**
 * Main find port function for browser
 * Maintains identical UX and messaging to Node.js version
 */
export async function findPortWeb(
  logger: (message: string) => void
): Promise<void> {
  logger("Finding all available ports for the MotorsBus.");

  // Check WebSerial support
  if (!isWebSerialSupported()) {
    throw new Error(
      "WebSerial API not supported. Please use Chrome/Edge 89+ with HTTPS or localhost."
    );
  }

  // Get initial ports (check what we already have access to)
  let portsBefore: SerialPort[];
  try {
    portsBefore = await findAvailablePortsWeb();
  } catch (error) {
    throw new Error(
      `Failed to get serial ports: ${
        error instanceof Error ? error.message : error
      }`
    );
  }

  // If no ports are available, request permission
  if (portsBefore.length === 0) {
    logger(
      "⚠️ No serial ports available. Requesting permission to access devices..."
    );
    await requestSerialPermission(logger);

    // Try again after permission request
    portsBefore = await findAvailablePortsWeb();

    if (portsBefore.length === 0) {
      throw new Error(
        'No ports detected. Please connect your devices, use "Show Available Ports" first, or check browser compatibility.'
      );
    }
  }

  // Show current ports
  const portsBeforeFormatted = formatPortInfo(portsBefore);
  logger(
    `Ports before disconnecting: [${portsBeforeFormatted
      .map((p) => `'${p}'`)
      .join(", ")}]`
  );

  // Ask user to disconnect device
  logger(
    "Remove the USB cable from your MotorsBus and press Continue when done."
  );
  await waitForUserAction(
    "Remove the USB cable from your MotorsBus and press Continue when done."
  );

  // Allow some time for port to be released (equivalent to Python's time.sleep(0.5))
  await sleep(500);

  // Get ports after disconnection
  const portsAfter = await findAvailablePortsWeb();
  const portsAfterFormatted = formatPortInfo(portsAfter);
  logger(
    `Ports after disconnecting: [${portsAfterFormatted
      .map((p) => `'${p}'`)
      .join(", ")}]`
  );

  // Find the difference by comparing port objects directly
  // This handles cases where multiple devices have the same vendor/product ID
  const removedPorts = portsBefore.filter((portBefore) => {
    return !portsAfter.includes(portBefore);
  });

  // If object comparison fails (e.g., browser creates new objects), fall back to count-based detection
  if (removedPorts.length === 0 && portsBefore.length > portsAfter.length) {
    const countDifference = portsBefore.length - portsAfter.length;
    if (countDifference === 1) {
      logger(`The port of this MotorsBus is one of the disconnected devices.`);
      logger(
        "Note: Exact port identification not possible with identical devices."
      );
      logger("Reconnect the USB cable.");
      return;
    } else {
      logger(`${countDifference} ports were removed, but expected exactly 1.`);
      logger("Please disconnect only one device and try again.");
      return;
    }
  }

  if (removedPorts.length === 1) {
    const port = formatPortInfo(removedPorts)[0];
    logger(`The port of this MotorsBus is '${port}'`);
    logger("Reconnect the USB cable.");
  } else if (removedPorts.length === 0) {
    logger("No difference found, did you remove the USB cable?");
    logger("Please try again: disconnect one device and click Continue.");
    return;
  } else {
    const portNames = formatPortInfo(removedPorts);
    throw new Error(
      `Could not detect the port. More than one port was found (${JSON.stringify(
        portNames
      )}).`
    );
  }
}

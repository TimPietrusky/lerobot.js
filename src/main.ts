/**
 * lerobot.js Web Interface
 *
 * Browser-based interface for lerobot functionality
 * Provides port connection and calibration functionality
 */

import "./web_interface.css";
import { findPortWeb } from "./lerobot/web/find_port.js";
import {
  calibrateWithPort,
  isWebSerialSupported,
} from "./lerobot/web/calibrate.js";

// Extend SerialPort interface for missing methods
declare global {
  interface SerialPort {
    getInfo(): { usbVendorId?: number; usbProductId?: number };
  }
}

// Store connected ports with connection state
let connectedPorts: { port: SerialPort; name: string; isConnected: boolean }[] =
  [];

// Store original console.log before override
const originalConsoleLog = console.log;

// Main application setup
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <h1>LeRobot.js Demo</h1>
    <p>Web Serial API implementation for robot calibration and control</p>
    
    <div id="serial-support" class="status"></div>
    
    <div class="cards-container">
      <!-- Port Connection Card -->
      <div class="card">
        <h2>🔌 Port Connection</h2>
        <p>Connect to your robot arms to test communication</p>
        
        <div class="controls">
          <button id="connect-port">Connect to Port</button>
          <button id="find-ports">Find Available Ports</button>
        </div>
        
        <div id="connected-ports">
          <h3>Connected Ports:</h3>
          <div id="ports-list">No ports connected</div>
        </div>
        
        <div id="find-ports-log"></div>
      </div>

      <!-- Robot Calibration Card -->
      <div class="card">
        <h2>🤖 Robot Calibration</h2>
        <p>Calibrate your SO-100 robot arms</p>
        
        <div class="controls">
          <div class="form-group">
            <label for="arm-type">Arm Type:</label>
            <select id="arm-type">
              <option value="so100_follower">SO-100 Follower (Robot)</option>
              <option value="so100_leader">SO-100 Leader (Teleoperator)</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="port-select">Select Port:</label>
            <select id="port-select">
              <option value="">No ports connected</option>
            </select>
          </div>
          
          <div class="form-group">
            <label for="arm-id">Arm ID:</label>
            <input type="text" id="arm-id" placeholder="e.g., my_robot" value="demo_arm">
          </div>
          
          <button id="start-calibration" disabled>Start Calibration</button>
        </div>
        
        <div id="calibration-status"></div>
      </div>
    </div>
    
    <div id="log"></div>
  </div>
`;

// Add CSS for cards
const style = document.createElement("style");
style.textContent = `
  .cards-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin: 2rem 0;
  }
  
  .card {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1.5rem;
    background: #f9f9f9;
  }
  
  .card h2 {
    margin-top: 0;
    color: #333;
  }
  
  .form-group {
    margin: 1rem 0;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
  }
  
  .form-group select,
  .form-group input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
  }
  
  .controls button {
    margin: 0.5rem 0.5rem 0.5rem 0;
  }
  
  #connected-ports {
    margin: 1rem 0;
    padding: 1rem;
    background: white;
    border-radius: 4px;
  }
  
  .port-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem;
    margin: 0.5rem 0;
    background: #e9f5ff;
    border-radius: 4px;
  }
  
  .port-item button {
    background: #dc3545;
    color: white;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.875rem;
    margin-left: 0.25rem;
  }
  
  .port-buttons {
    display: flex;
    gap: 0.25rem;
  }
  
  .port-buttons button:not(.unpair-btn) {
    background: #007bff;
  }
  
  .unpair-btn {
    background: #dc3545 !important;
  }
`;
document.head.appendChild(style);

// Initialize the application
async function initializeApp() {
  // Check Web Serial API support
  const supportDiv = document.querySelector<HTMLDivElement>("#serial-support")!;
  if (isWebSerialSupported()) {
    supportDiv.innerHTML = `
      <div class="success">✅ Web Serial API is supported in this browser</div>
    `;

    // Restore previously connected ports on page load
    await restoreConnectedPorts();
  } else {
    supportDiv.innerHTML = `
      <div class="error">❌ Web Serial API is not supported. Please use Chrome/Edge with experimental features enabled.</div>
    `;
  }
}

// Restore connected ports from browser's serial port list
async function restoreConnectedPorts() {
  try {
    const existingPorts = await navigator.serial.getPorts();

    for (const port of existingPorts) {
      // Try to reconnect to previously permitted ports
      let isConnected = false;
      const portName = getPortDisplayName(port);

      try {
        // Check if port is already open, if not, open it
        if (!port.readable || !port.writable) {
          await port.open({ baudRate: 1000000 });
        }
        isConnected = true;
        originalConsoleLog(`Restored connection to: ${portName}`);
      } catch (error) {
        originalConsoleLog(`Could not reconnect to port ${portName}:`, error);
        // Port might be in use by another application or disconnected
        // But we still add it to the list so user can see it's paired
      }

      connectedPorts.push({ port, name: portName, isConnected });
    }

    if (connectedPorts.length > 0) {
      const connectedCount = connectedPorts.filter((p) => p.isConnected).length;
      originalConsoleLog(
        `Found ${connectedPorts.length} paired ports, ${connectedCount} connected`
      );
      updatePortsList();
      updateCalibrationButton();
    }
  } catch (error) {
    originalConsoleLog("Could not restore ports:", error);
  }
}

// Get a meaningful display name for a port
function getPortDisplayName(port: SerialPort): string {
  // Use original console.log to avoid showing debug info in the page UI
  originalConsoleLog("=== PORT DEBUG INFO ===");
  originalConsoleLog("Full port object:", port);
  originalConsoleLog("Port readable:", port.readable);
  originalConsoleLog("Port writable:", port.writable);

  try {
    const info = port.getInfo();
    originalConsoleLog("Port getInfo() result:", info);
    originalConsoleLog("USB Vendor ID:", info.usbVendorId);
    originalConsoleLog("USB Product ID:", info.usbProductId);

    // Log all properties of the info object
    originalConsoleLog("All info properties:");
    for (const [key, value] of Object.entries(info)) {
      originalConsoleLog(`  ${key}:`, value);
    }

    // Try to extract port name from port info
    if (info.usbVendorId && info.usbProductId) {
      return `USB Port (${info.usbVendorId}:${info.usbProductId})`;
    }

    // For Windows COM ports, we can't get the exact name from Web Serial API
    // but we can show some identifying information
    if (info.usbVendorId) {
      return `Serial Port (VID:${info.usbVendorId.toString(16).toUpperCase()})`;
    }
  } catch (error) {
    // getInfo() might not be available in all browsers
    originalConsoleLog("Port info not available:", error);
  }

  originalConsoleLog("=== END PORT DEBUG ===");

  // Fallback to generic name with unique identifier
  const portIndex = connectedPorts.length;
  return `Serial Port ${portIndex + 1}`;
}

// Simple port connection functionality (restored)
const connectPortBtn =
  document.querySelector<HTMLButtonElement>("#connect-port")!;
const portsListDiv = document.querySelector<HTMLDivElement>("#ports-list")!;

connectPortBtn.addEventListener("click", async () => {
  try {
    connectPortBtn.disabled = true;
    connectPortBtn.textContent = "Connecting...";

    // Simple port connection dialog
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 1000000 });

    // Add to connected ports with meaningful name
    const portName = getPortDisplayName(port);
    connectedPorts.push({ port, name: portName, isConnected: true });

    updatePortsList();
    updateCalibrationButton();

    connectPortBtn.textContent = "Connect to Port";
  } catch (error) {
    alert(
      `Failed to connect to port: ${
        error instanceof Error ? error.message : error
      }`
    );
    connectPortBtn.textContent = "Connect to Port";
  } finally {
    connectPortBtn.disabled = false;
  }
});

// Update connected ports display
function updatePortsList() {
  if (connectedPorts.length === 0) {
    portsListDiv.innerHTML = "No ports paired";
  } else {
    portsListDiv.innerHTML = connectedPorts
      .map(
        (portInfo, index) => `
      <div class="port-item">
        <span>${portInfo.name} ${portInfo.isConnected ? "🟢" : "🔴"}</span>
        <div class="port-buttons">
          ${
            portInfo.isConnected
              ? `<button onclick="disconnectPort(${index})">Disconnect</button>`
              : `<button onclick="reconnectPort(${index})">Connect</button>`
          }
          <button onclick="unpairPort(${index})" class="unpair-btn">Unpair</button>
        </div>
      </div>
    `
      )
      .join("");
  }

  // Update port selector dropdown (only show connected ports for calibration)
  updatePortSelector();
}

// Update port selector dropdown
function updatePortSelector() {
  const portSelect = document.querySelector<HTMLSelectElement>("#port-select")!;

  const connectedOnly = connectedPorts.filter(
    (portInfo) => portInfo.isConnected
  );

  if (connectedOnly.length === 0) {
    portSelect.innerHTML = '<option value="">No ports connected</option>';
  } else {
    portSelect.innerHTML = connectedOnly
      .map((portInfo, connectedIndex) => {
        // Find the original index in the full connectedPorts array
        const originalIndex = connectedPorts.findIndex((p) => p === portInfo);
        return `<option value="${originalIndex}">${portInfo.name}</option>`;
      })
      .join("");
  }
}

// Make port management functions global
(window as any).disconnectPort = async (index: number) => {
  try {
    const portInfo = connectedPorts[index];
    await portInfo.port.close();
    connectedPorts[index].isConnected = false;
    updatePortsList();
    updateCalibrationButton();
    originalConsoleLog(`Disconnected from ${portInfo.name}`);
  } catch (error) {
    console.error("Failed to disconnect port:", error);
  }
};

(window as any).reconnectPort = async (index: number) => {
  try {
    const portInfo = connectedPorts[index];
    await portInfo.port.open({ baudRate: 1000000 });
    connectedPorts[index].isConnected = true;
    updatePortsList();
    updateCalibrationButton();
    originalConsoleLog(`Reconnected to ${portInfo.name}`);
  } catch (error) {
    console.error("Failed to reconnect to port:", error);
    alert(
      `Failed to reconnect: ${error instanceof Error ? error.message : error}`
    );
  }
};

(window as any).unpairPort = async (index: number) => {
  try {
    const portInfo = connectedPorts[index];

    // Close the port first if it's connected
    if (portInfo.isConnected) {
      await portInfo.port.close();
    }

    // Try to forget the port (requires newer browsers)
    if ("forget" in portInfo.port) {
      await (portInfo.port as any).forget();
      originalConsoleLog(`Unpaired ${portInfo.name}`);
    } else {
      // Fallback for browsers that don't support forget()
      originalConsoleLog(
        `Browser doesn't support forget() - manually revoke in browser settings`
      );
      alert(
        "This browser doesn't support automatic unpairing. Please revoke access manually in browser settings (Privacy & Security > Site Settings > Serial Ports)"
      );
    }

    // Remove from our list
    connectedPorts.splice(index, 1);
    updatePortsList();
    updateCalibrationButton();
  } catch (error) {
    console.error("Failed to unpair port:", error);
    alert(
      `Failed to unpair: ${error instanceof Error ? error.message : error}`
    );
  }
};

// Set up find ports functionality (restored original)
const findPortsBtn = document.querySelector<HTMLButtonElement>("#find-ports")!;
const findPortsLogDiv =
  document.querySelector<HTMLDivElement>("#find-ports-log")!;

findPortsBtn.addEventListener("click", async () => {
  try {
    findPortsBtn.disabled = true;
    findPortsBtn.textContent = "Finding ports...";

    // Clear previous results
    findPortsLogDiv.innerHTML = '<div class="status">Finding ports...</div>';

    // Use the web find port functionality
    await findPortWeb((message: string) => {
      findPortsLogDiv.innerHTML += `<div class="log-entry">${message}</div>`;
    });
  } catch (error) {
    // Check if user cancelled the dialog
    if (
      error instanceof Error &&
      (error.message.includes("cancelled") ||
        error.message.includes("canceled") ||
        error.name === "NotAllowedError" ||
        error.name === "AbortError")
    ) {
      // User cancelled - just log it, no UI message
      console.log("Find ports cancelled by user");
    } else {
      // Real error - show it
      findPortsLogDiv.innerHTML = `
        <div class="error">Error finding ports: ${
          error instanceof Error ? error.message : error
        }</div>
      `;
    }
  } finally {
    findPortsBtn.disabled = false;
    findPortsBtn.textContent = "Find Available Ports";
  }
});

// Calibration functionality
const armTypeSelect = document.querySelector<HTMLSelectElement>("#arm-type")!;
const portSelect = document.querySelector<HTMLSelectElement>("#port-select")!;
const armIdInput = document.querySelector<HTMLInputElement>("#arm-id")!;
const startCalibrationBtn =
  document.querySelector<HTMLButtonElement>("#start-calibration")!;
const calibrationStatusDiv = document.querySelector<HTMLDivElement>(
  "#calibration-status"
)!;

function updateCalibrationButton() {
  const hasConnectedPorts = connectedPorts.some((port) => port.isConnected);
  startCalibrationBtn.disabled = !hasConnectedPorts;

  if (!hasConnectedPorts) {
    startCalibrationBtn.textContent = "Connect a port first";
  } else {
    startCalibrationBtn.textContent = "Start Calibration";
  }
}

startCalibrationBtn.addEventListener("click", async () => {
  try {
    startCalibrationBtn.disabled = true;
    startCalibrationBtn.textContent = "Calibrating...";
    calibrationStatusDiv.innerHTML =
      '<div class="status">Starting calibration...</div>';

    const armType = armTypeSelect.value as "so100_follower" | "so100_leader";
    const portIndexStr = portSelect.value;
    const armId = armIdInput.value.trim() || "demo_arm";

    // Validate port selection
    if (portIndexStr === "" || connectedPorts.length === 0) {
      throw new Error("No port selected");
    }

    const portIndex = parseInt(portIndexStr);
    if (portIndex < 0 || portIndex >= connectedPorts.length) {
      throw new Error("Invalid port selection");
    }

    const selectedPortInfo = connectedPorts[portIndex];
    if (!selectedPortInfo.isConnected) {
      throw new Error("Selected port is not connected");
    }

    const selectedPort = selectedPortInfo.port;
    await calibrateWithPort(armType, armId, selectedPort);

    calibrationStatusDiv.innerHTML =
      '<div class="success">✅ Calibration completed successfully!</div>';
    startCalibrationBtn.textContent = "Start Calibration";
  } catch (error) {
    calibrationStatusDiv.innerHTML = `
      <div class="error">❌ Calibration failed: ${
        error instanceof Error ? error.message : error
      }</div>
    `;
    startCalibrationBtn.textContent = "Start Calibration";
  } finally {
    startCalibrationBtn.disabled = !connectedPorts.some(
      (port) => port.isConnected
    );
  }
});

// Initialize
updateCalibrationButton();

// Initialize the application
initializeApp();

// Override console.log to show in the page
const logDiv = document.querySelector<HTMLDivElement>("#log")!;
console.log = (...args) => {
  originalConsoleLog.apply(console, args);

  const logEntry = document.createElement("div");
  logEntry.className = "log-entry";
  logEntry.textContent = args.join(" ");
  logDiv.appendChild(logEntry);
  logDiv.scrollTop = logDiv.scrollHeight;
};

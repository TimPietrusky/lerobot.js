/**
 * lerobot.js Web Interface
 *
 * Browser-based interface for lerobot functionality
 * Provides the same find-port functionality as the CLI but in the browser
 */

import "./web_interface.css";
import { findPortWeb } from "./lerobot/web/find_port.js";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="lerobot-app">
    <header class="lerobot-header">
      <h1>🤖 lerobot.js</h1>
      <p>use your robot in the web & node with an api similar to LeRobot in python</p>
    </header>
    
    <main class="lerobot-main">
      <section class="tool-section">
        <h2>🔍 Find USB Ports</h2>
        <p>Identify which USB ports your robot arms are connected to</p>
        <div class="button-group">
          <button id="show-ports-btn" class="secondary-btn" style="display: none;">Show Available Ports</button>
          <button id="manage-devices-btn" class="secondary-btn">Manage Devices</button>
          <button id="find-port-btn" class="primary-btn">Find MotorsBus Port</button>
        </div>
        <div id="info-box" class="info-box" style="display: none;">
          <span class="info-icon">💡</span>
          <span class="info-text">Use "Manage Devices" to pair additional devices or "Find MotorsBus Port" to start detection.</span>
        </div>
        <div id="port-results" class="results-area"></div>
      </section>
      
      <section class="info-section" id="compatibility-section" style="display: none;">
        <h3>Browser Compatibility Issue</h3>
        <p>Your browser doesn't support the <a href="https://web.dev/serial/" target="_blank">WebSerial API</a>. Please use:</p>
        <ul>
          <li>Chrome/Edge 89+ or Chrome Android 105+</li>
          <li>HTTPS connection (or localhost for development)</li>
        </ul>
        <p>Alternatively, use the <strong>CLI version</strong>: <code>npx lerobot find-port</code></p>
      </section>
    </main>
  </div>
`;

// Set up button functionality
const showPortsBtn =
  document.querySelector<HTMLButtonElement>("#show-ports-btn")!;
const manageDevicesBtn = document.querySelector<HTMLButtonElement>(
  "#manage-devices-btn"
)!;
const findPortBtn =
  document.querySelector<HTMLButtonElement>("#find-port-btn")!;
const resultsArea = document.querySelector<HTMLDivElement>("#port-results")!;
const infoBox = document.querySelector<HTMLDivElement>("#info-box")!;

// Function to display paired devices
async function displayPairedDevices() {
  try {
    // Check WebSerial support
    if (!("serial" in navigator)) {
      resultsArea.innerHTML =
        '<p class="error">WebSerial API not supported. Please use Chrome/Edge 89+ with HTTPS or localhost.</p>';
      infoBox.style.display = "none";
      showPortsBtn.style.display = "inline-block";
      return;
    }

    // Check what ports we already have access to
    const ports = await navigator.serial.getPorts();

    if (ports.length > 0) {
      // We have paired devices, show them
      resultsArea.innerHTML = `<p class="success">Found ${ports.length} paired device(s):</p>`;
      ports.forEach((port, index) => {
        const info = port.getInfo();
        if (info.usbVendorId && info.usbProductId) {
          resultsArea.innerHTML += `<p class="log">Port ${index + 1}: USB:${
            info.usbVendorId
          }:${info.usbProductId}</p>`;
        } else {
          resultsArea.innerHTML += `<p class="log">Port ${
            index + 1
          }: Serial device</p>`;
        }
      });

      // Show the info box with guidance
      infoBox.style.display = "flex";

      // Hide show ports button since we have devices
      showPortsBtn.style.display = "none";
    } else {
      // No devices paired, show helpful message
      resultsArea.innerHTML =
        '<p class="log">No paired devices found. Click "Show Available Ports" to get started.</p>';

      // Hide the info box since we don't have devices
      infoBox.style.display = "none";

      // Show the show ports button since we need it
      showPortsBtn.style.display = "inline-block";
    }
  } catch (error) {
    resultsArea.innerHTML += `<p class="error">Error checking devices: ${
      error instanceof Error ? error.message : error
    }</p>`;
    infoBox.style.display = "none";
    showPortsBtn.style.display = "inline-block";
  }
}

// Check browser compatibility and show warning if needed
function checkBrowserCompatibility() {
  const compatibilitySection = document.querySelector(
    "#compatibility-section"
  ) as HTMLElement;

  if (!("serial" in navigator)) {
    // Browser doesn't support WebSerial API, show compatibility warning
    compatibilitySection.style.display = "block";
  } else {
    // Browser supports WebSerial API, hide compatibility section
    compatibilitySection.style.display = "none";
  }
}

// Check for paired devices and browser compatibility on page load
checkBrowserCompatibility();
displayPairedDevices();

// Show available ports button (only for when no devices are paired)
showPortsBtn.addEventListener("click", async () => {
  try {
    showPortsBtn.disabled = true;
    showPortsBtn.textContent = "Pairing devices...";
    resultsArea.innerHTML =
      '<p class="status">Requesting permission to access serial ports...</p>';

    try {
      await navigator.serial.requestPort();
      // Refresh the display
      await displayPairedDevices();
    } catch (permissionError) {
      console.log("Permission dialog cancelled:", permissionError);
    }
  } catch (error) {
    resultsArea.innerHTML += `<p class="error">Error: ${
      error instanceof Error ? error.message : error
    }</p>`;
  } finally {
    showPortsBtn.disabled = false;
    showPortsBtn.textContent = "Show Available Ports";
  }
});

// Manage devices button (always available)
manageDevicesBtn.addEventListener("click", async () => {
  try {
    manageDevicesBtn.disabled = true;
    manageDevicesBtn.textContent = "Managing...";

    // Always show the permission dialog to pair new devices
    try {
      await navigator.serial.requestPort();
      // Refresh the display to show updated device list
      await displayPairedDevices();
      resultsArea.innerHTML +=
        '<p class="success">Device pairing completed. Updated device list above.</p>';
    } catch (permissionError) {
      console.log("Permission dialog cancelled:", permissionError);
    }
  } catch (error) {
    resultsArea.innerHTML += `<p class="error">Error: ${
      error instanceof Error ? error.message : error
    }</p>`;
  } finally {
    manageDevicesBtn.disabled = false;
    manageDevicesBtn.textContent = "Manage Devices";
    resultsArea.scrollTop = resultsArea.scrollHeight;
  }
});

// Find port button
findPortBtn.addEventListener("click", async () => {
  try {
    findPortBtn.disabled = true;
    findPortBtn.textContent = "Finding ports...";
    resultsArea.innerHTML = '<p class="status">Starting port detection...</p>';

    await findPortWeb((message: string) => {
      resultsArea.innerHTML += `<p class="log">${message}</p>`;
      resultsArea.scrollTop = resultsArea.scrollHeight;
    });
  } catch (error) {
    resultsArea.innerHTML += `<p class="error">Error: ${
      error instanceof Error ? error.message : error
    }</p>`;
  } finally {
    findPortBtn.disabled = false;
    findPortBtn.textContent = "Find MotorsBus Port";
  }
});

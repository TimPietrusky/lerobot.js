/**
 * Iframe Dialog Test Logic
 * Tests WebSerial + WebUSB dialog behavior in iframe vs standalone environments
 */

import { findPort } from "@lerobot/web";

let isRunning = false;

function log(message: string) {
  const logElement = document.getElementById("log");
  if (logElement) {
    const timestamp = new Date().toLocaleTimeString();
    logElement.textContent += `[${timestamp}] ${message}\n`;
    logElement.scrollTop = logElement.scrollHeight;
  }
}

function setButtonState(buttonId: string, running: boolean) {
  const button = document.getElementById(buttonId) as HTMLButtonElement;
  if (button) {
    button.disabled = running;
    if (running) {
      button.textContent = "⏳ Testing...";
    } else {
      // Restore original text
      if (buttonId === "testStandalone") {
        button.textContent = "🖥️ Test Standalone (Current Window)";
      }
    }
  }
}

// Mock implementation to test dialog behavior without actual findPort
async function testDialogBehavior(environment: "standalone" | "iframe") {
  log(`🎯 Testing dialog behavior in ${environment} environment...`);

  try {
    // Method 1: Sequential (current approach)
    log("📡 Method 1: Sequential WebSerial → WebUSB");

    log("🔸 Requesting WebSerial port...");
    const serialPort = await navigator.serial.requestPort();
    log("✅ WebSerial port selected");

    log("🔸 Requesting WebUSB device...");
    const usbDevice = await navigator.usb.requestDevice({ filters: [] });
    log("✅ WebUSB device selected");

    log("🎉 Sequential method succeeded!");
    return { serialPort, usbDevice, method: "sequential" };
  } catch (error: any) {
    log(`❌ Sequential method failed: ${error.message}`);

    // Method 2: Simultaneous (new approach)
    try {
      log("📡 Method 2: Simultaneous WebSerial + WebUSB");

      log("🚀 Starting both dialogs simultaneously...");
      const [serialPortPromise, usbDevicePromise] = [
        navigator.serial.requestPort(),
        navigator.usb.requestDevice({ filters: [] }),
      ];

      log("⏳ Waiting for both dialogs...");
      const [serialPort, usbDevice] = await Promise.all([
        serialPortPromise,
        usbDevicePromise,
      ]);

      log("✅ Both dialogs completed!");
      log("🎉 Simultaneous method succeeded!");
      return { serialPort, usbDevice, method: "simultaneous" };
    } catch (simultaneousError: any) {
      log(`❌ Simultaneous method also failed: ${simultaneousError.message}`);
      throw simultaneousError;
    }
  }
}

// Test using actual findPort function
async function testActualFindPort() {
  log("🔍 Testing actual findPort function...");

  try {
    const findProcess = await findPort();
    const robots = await findProcess.result;

    log(`✅ findPort succeeded! Found ${robots.length} robots`);
    robots.forEach((robot, index) => {
      log(`  Robot ${index + 1}: ${robot.name} (${robot.robotType})`);
    });

    return robots;
  } catch (error: any) {
    log(`❌ findPort failed: ${error.message}`);
    throw error;
  }
}

declare global {
  interface Window {
    clearLog: () => void;
    testStandalone: () => Promise<void>;
    loadIframe: (mode: string) => void;
  }
}

window.clearLog = function () {
  const logElement = document.getElementById("log");
  if (logElement) {
    logElement.textContent = "Log cleared.\n";
  }
};

window.loadIframe = function (mode: string) {
  const iframe = document.getElementById("testFrame") as HTMLIFrameElement;
  const infoElement = document.getElementById("iframeInfo");

  if (!iframe) return;

  // Clear existing attributes
  iframe.removeAttribute("sandbox");
  iframe.removeAttribute("allow");

  let iframeContent = "";
  let description = "";

  switch (mode) {
    case "permissive":
      // Most permissive - similar to our original test
      iframe.setAttribute("allow", "serial; usb");
      description = "Permissive: Full access to WebSerial and WebUSB";
      iframeContent = generateIframeContent();
      break;

    case "restricted":
      // Restricted with sandbox - might block certain permissions
      iframe.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-forms"
      );
      iframe.setAttribute("allow", "serial; usb");
      description = "Restricted: Sandboxed with limited permissions";
      iframeContent = generateIframeContent();
      break;

    case "crossorigin":
      // Cross-origin simulation (limited local test)
      iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-forms");
      iframe.setAttribute("allow", "serial; usb");
      description = "Cross-Origin: Different origin with sandbox restrictions";
      iframeContent = generateIframeContent();
      break;
  }

  if (infoElement) {
    infoElement.textContent = `Current iframe mode: ${description}`;
  }

  iframe.src =
    "data:text/html;charset=utf-8," + encodeURIComponent(iframeContent);
  log(`📝 Loaded iframe in ${mode} mode: ${description}`);
};

window.testStandalone = async function () {
  if (isRunning) return;

  isRunning = true;
  setButtonState("testStandalone", true);
  log("🧪 Testing with actual findPort function...");

  try {
    // Test the actual findPort function with our new fallback logic
    await testActualFindPort();

    log("\n✅ findPort test completed!");
  } catch (error: any) {
    log(`❌ findPort test failed: ${error.message}`);

    // Analyze the error
    if (error.message.includes("user gesture")) {
      log("🔍 User gesture consumption detected!");
      log("💡 This confirms the issue - WebSerial consumes the gesture");
    } else if (error.message.includes("cancelled")) {
      log("🔍 User cancelled dialog - this is expected for testing");
    } else if (error.message.includes("No port selected")) {
      log("🔍 Dialog conflict detected - this should trigger fallback mode");
    }
  } finally {
    isRunning = false;
    setButtonState("testStandalone", false);
  }
};

// Generate iframe content dynamically
function generateIframeContent(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iframe Test Content</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            padding: 20px;
            margin: 0;
            background: white;
            text-align: center;
        }
        button {
            background: #2563eb;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
            font-size: 14px;
        }
        button:hover {
            background: #1d4ed8;
        }
        button:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
        .status {
            margin: 10px 0;
            padding: 10px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <h3>🖼️ Inside Iframe</h3>
    <p>This simulates HuggingFace Spaces environment</p>
    
    <button onclick="testActualFindPort()">Test Actual findPort Function</button>
    <button onclick="testIframeDialogs()">Test Mock Sequential</button>
    <button onclick="testIframeSimultaneous()">Test Mock Simultaneous</button>
    
    <div id="iframeStatus" class="status">Ready to test...</div>
    
    <script type="module">
        import { findPort } from '../packages/web/src/index.js';
        
        function updateStatus(message) {
            const status = document.getElementById('iframeStatus');
            const timestamp = new Date().toLocaleTimeString();
            status.textContent = timestamp + ': ' + message;
            
            // Also log to parent window
            window.parent.postMessage({
                type: 'iframe-log',
                message: message
            }, '*');
        }
        
        window.testIframeDialogs = async function() {
            updateStatus('Testing sequential dialogs...');
            
            try {
                updateStatus('Requesting WebSerial port...');
                const serialPort = await navigator.serial.requestPort();
                updateStatus('WebSerial port selected');
                
                updateStatus('Requesting WebUSB device...');
                const usbDevice = await navigator.usb.requestDevice({ filters: [] });
                updateStatus('WebUSB device selected - SUCCESS!');
                
            } catch (error) {
                updateStatus('Failed: ' + error.message);
            }
        };
        
        window.testIframeSimultaneous = async function() {
            updateStatus('Testing simultaneous dialogs...');
            
            try {
                updateStatus('Starting both dialogs simultaneously...');
                const [serialPortPromise, usbDevicePromise] = [
                    navigator.serial.requestPort(),
                    navigator.usb.requestDevice({ filters: [] })
                ];
                
                const [serialPort, usbDevice] = await Promise.all([
                    serialPortPromise,
                    usbDevicePromise
                ]);
                
                updateStatus('Both dialogs completed - SUCCESS!');
                
            } catch (error) {
                updateStatus('Failed: ' + error.message);
            }
        };
        
        // Test actual findPort function (imported at top)
        window.testActualFindPort = async function() {
            updateStatus('Testing actual findPort function...');
            
            try {
                updateStatus('Starting findPort with fallback behavior...');
                const findProcess = await findPort({
                    onMessage: (msg) => updateStatus('findPort: ' + msg)
                });
                
                const robots = await findProcess.result;
                updateStatus('SUCCESS! Found ' + robots.length + ' robots');
                
                robots.forEach((robot, index) => {
                    updateStatus('Robot ' + (index + 1) + ': ' + robot.name + ' (' + robot.robotType + ')');
                });
                
            } catch (error) {
                updateStatus('findPort failed: ' + error.message);
                
                // Analyze the error for debugging
                if (error.message.includes('No port selected')) {
                    updateStatus('🔍 This should trigger sequential fallback mode');
                } else if (error.message.includes('cancelled')) {
                                      updateStatus('🔍 User cancelled dialog - expected for testing');
              }
          }
      };
        
        // Check environment
        updateStatus('Environment: ' + (window === window.top ? 'Standalone' : 'Iframe'));
        updateStatus('WebSerial: ' + ('serial' in navigator ? 'Supported' : 'Not supported'));
        updateStatus('WebUSB: ' + ('usb' in navigator ? 'Supported' : 'Not supported'));
    </script>
</body>
</html>
  `;
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  // Check browser support
  if (!("serial" in navigator)) {
    log("❌ WebSerial API not supported in this browser");
    log("💡 Try Chrome/Edge with --enable-web-serial flag");
    const button = document.getElementById(
      "testStandalone"
    ) as HTMLButtonElement;
    if (button) button.disabled = true;
  } else {
    log("✅ WebSerial API supported");
  }

  if (!("usb" in navigator)) {
    log("❌ WebUSB API not supported in this browser");
    log("💡 Try Chrome/Edge with --enable-web-usb flag");
  } else {
    log("✅ WebUSB API supported");
  }

  log("🎯 Environment: " + (window === window.top ? "Standalone" : "Iframe"));
  log("Ready to test dialog behavior...");

  // Set up iframe content - start with permissive mode
  window.loadIframe("permissive");

  // Listen for messages from iframe
  window.addEventListener("message", (event) => {
    if (event.data.type === "iframe-log") {
      log(`[IFRAME] ${event.data.message}`);
    }
  });
});

/**
 * Sequential Operations Test Logic
 * Tests: findPort → calibrate → releaseMotors → teleoperate
 */

import {
  findPort,
  calibrate,
  releaseMotors,
  teleoperate,
  WebSerialPortWrapper,
  createSO100Config,
} from "@lerobot/web";

let isRunning = false;

function log(message: string) {
  const logElement = document.getElementById("log");
  if (logElement) {
    const timestamp = new Date().toLocaleTimeString();
    logElement.textContent += `[${timestamp}] ${message}\n`;
    logElement.scrollTop = logElement.scrollHeight;
  }
}

function setButtonState(running: boolean) {
  isRunning = running;
  const button = document.getElementById("runTest") as HTMLButtonElement;
  if (button) {
    button.disabled = running;
    button.textContent = running
      ? "⏳ Running Test..."
      : "🚀 Run Sequential Operations Test";
  }
}

declare global {
  interface Window {
    clearLog: () => void;
    runSequentialTest: () => Promise<void>;
  }
}

window.clearLog = function () {
  const logElement = document.getElementById("log");
  if (logElement) {
    logElement.textContent = "Log cleared.\n";
  }
};

window.runSequentialTest = async function () {
  if (isRunning) return;

  setButtonState(true);
  log("🚀 Starting sequential operations test...");

  try {
    // Step 1: Find port
    log("\n1️⃣ Finding robot port...");
    const findProcess = await findPort();
    const robots = await findProcess.result;
    const robot = robots[0]; // Get first robot

    if (!robot || !robot.isConnected) {
      throw new Error("No robot found or robot not connected");
    }

    log(`✅ Found robot: ${robot.name} (${robot.robotType})`);
    log(`   Serial: ${robot.serialNumber}`);

    // Step 2: Release motors first, then calibrate
    log("\n2️⃣ Releasing motors for calibration setup...");

    if (!robot.robotType) {
      throw new Error("Robot type not configured");
    }

    // Release motors so you can move the arm during calibration
    log("🔧 Creating port and config for motor release...");
    const setupPort = new WebSerialPortWrapper(robot.port);
    await setupPort.initialize();
    const setupConfig = createSO100Config(robot.robotType);

    log(`🔓 Releasing ${setupConfig.motorIds.length} motors...`);
    await releaseMotors(setupPort, setupConfig.motorIds);
    log("✅ Motors released - you can now move the arm freely!");

    // Now start calibration
    log("\n📏 Starting calibration with live position updates...");
    log("💡 Move the arm through its range of motion to see live updates!");

    const useSimulatedCalibration = false; // Real calibration to see live updates
    let calibrationResult: any;

    if (useSimulatedCalibration) {
      // Simulated calibration data (for testing without robot movement)
      log("📊 Using simulated calibration data for testing...");
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate calibration time

      calibrationResult = {
        shoulder_pan: {
          id: 1,
          drive_mode: 0,
          homing_offset: 34,
          range_min: 994,
          range_max: 3100,
        },
        shoulder_lift: {
          id: 2,
          drive_mode: 0,
          homing_offset: 991,
          range_min: 960,
          range_max: 3233,
        },
        elbow_flex: {
          id: 3,
          drive_mode: 0,
          homing_offset: -881,
          range_min: 1029,
          range_max: 3065,
        },
        wrist_flex: {
          id: 4,
          drive_mode: 0,
          homing_offset: 128,
          range_min: 710,
          range_max: 3135,
        },
        wrist_roll: {
          id: 5,
          drive_mode: 0,
          homing_offset: -15,
          range_min: 0,
          range_max: 4095,
        },
        gripper: {
          id: 6,
          drive_mode: 0,
          homing_offset: -1151,
          range_min: 2008,
          range_max: 3606,
        },
      };

      log("✅ Calibration completed (simulated)");
    } else {
      // Real calibration
      const calibrationProcess = await calibrate(robot, {
        onProgress: (message) => log(`📊 ${message}`),
        onLiveUpdate: (data) => {
          const motors = Object.keys(data);
          if (motors.length > 0) {
            const ranges = motors.map((m) => data[m].range).join(", ");
            log(`📏 Motor ranges: [${ranges}]`);
          }
        },
      });

      // Auto-stop calibration after 8 seconds for testing
      setTimeout(() => {
        log("⏱️ Auto-stopping calibration for test...");
        calibrationProcess.stop();
      }, 8000);

      await calibrationProcess.result;
      log("✅ Calibration completed (real)");
    }

    // Step 3: Use your provided calibration config for teleoperation
    log("\n3️⃣ Setting up teleoperation with your calibration config...");

    // Use your provided calibration config instead of real calibration result
    calibrationResult = {
      shoulder_pan: {
        id: 1,
        drive_mode: 0,
        homing_offset: 34,
        range_min: 994,
        range_max: 3100,
      },
      shoulder_lift: {
        id: 2,
        drive_mode: 0,
        homing_offset: 991,
        range_min: 960,
        range_max: 3233,
      },
      elbow_flex: {
        id: 3,
        drive_mode: 0,
        homing_offset: -881,
        range_min: 1029,
        range_max: 3065,
      },
      wrist_flex: {
        id: 4,
        drive_mode: 0,
        homing_offset: 128,
        range_min: 710,
        range_max: 3135,
      },
      wrist_roll: {
        id: 5,
        drive_mode: 0,
        homing_offset: -15,
        range_min: 0,
        range_max: 4095,
      },
      gripper: {
        id: 6,
        drive_mode: 0,
        homing_offset: -1151,
        range_min: 2008,
        range_max: 3606,
      },
    };

    log(
      `✅ Using your calibration config: ${Object.keys(calibrationResult).join(
        ", "
      )}`
    );

    // Step 4: Teleoperate with auto key simulation
    log("\n4️⃣ Starting teleoperation...");
    const teleoperationProcess = await teleoperate(robot, {
      calibrationData: calibrationResult,
      onStateUpdate: (state) => {
        if (state.isActive && Object.keys(state.keyStates).length > 0) {
          const activeKeys = Object.keys(state.keyStates).filter(
            (k) => state.keyStates[k].pressed
          );
          log(`🎮 Auto-simulated keys: ${activeKeys.join(", ")}`);
        }
      },
    });

    teleoperationProcess.start();
    log("✅ Teleoperation started");
    log("🤖 Auto-simulating arrow key presses to move the arm...");

    // Auto-simulate key presses (left/right arrows to move shoulder pan)
    let keySimulationActive = true;
    let currentDirection = "ArrowLeft";

    const simulateKeys = () => {
      if (!keySimulationActive) return;

      // Press current key
      teleoperationProcess.updateKeyState(currentDirection, true);
      log(`🔄 Pressing ${currentDirection} (shoulder pan movement)`);

      // Hold for 1 second, then release and switch direction
      setTimeout(() => {
        if (!keySimulationActive) return;
        teleoperationProcess.updateKeyState(currentDirection, false);

        // Switch direction
        currentDirection =
          currentDirection === "ArrowLeft" ? "ArrowRight" : "ArrowLeft";

        // Wait 500ms then start next movement
        setTimeout(() => {
          if (keySimulationActive) simulateKeys();
        }, 500);
      }, 1000);
    };

    // Start key simulation after a brief delay
    setTimeout(simulateKeys, 1000);

    // Auto-stop teleoperation after 8 seconds for testing
    setTimeout(() => {
      keySimulationActive = false;
      log("⏱️ Auto-stopping teleoperation for test...");
      teleoperationProcess.stop();
      log("\n🎉 All sequential operations completed successfully!");
      log(
        "\n📝 RESULT: The current approach works but is too complex for users!"
      );
      log(
        "📝 Users shouldn't need WebSerialPortWrapper and createSO100Config!"
      );
      setButtonState(false);
    }, 8000);
  } catch (error: any) {
    log(`❌ Sequential operations failed: ${error.message}`);

    // Check if it's a connection conflict
    if (
      error.message.includes("port") ||
      error.message.includes("serial") ||
      error.message.includes("connection")
    ) {
      log("🔍 This might be a port connection conflict!");
      log("💡 Multiple WebSerialPortWrapper instances may be interfering");
    }

    setButtonState(false);
  }
};

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  // Check Web Serial support
  if (!("serial" in navigator)) {
    log("❌ Web Serial API not supported in this browser");
    log("💡 Try Chrome/Edge with --enable-web-serial flag");
    const button = document.getElementById("runTest") as HTMLButtonElement;
    if (button) button.disabled = true;
  } else {
    log("✅ Web Serial API supported");
    log("Ready to test. Click 'Run Sequential Operations Test' to begin...");
  }
});

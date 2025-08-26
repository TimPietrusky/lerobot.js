/**
 * Calibration Demo
 *
 * Demonstrates robot motor calibration with live feedback
 */

import { findPort, connectPort, releaseMotors, calibrate } from "@lerobot/node";
import type { RobotConnection, DiscoveredPort } from "@lerobot/node";

async function demoCalibrate() {
  console.log("🎯 Calibration Demo");
  console.log("===================\n");

  try {
    // Step 1: Find available robot ports
    console.log("📡 Looking for connected robots...");
    const findProcess = await findPort();
    const discoveredPorts = await findProcess.result;

    if (discoveredPorts.length === 0) {
      throw new Error("No robots found. Please connect your robot first.");
    }

    console.log(`✅ Found robot on ${discoveredPorts[0].path}`);

    // Step 2: Connect to robot
    console.log("🔌 Connecting to robot...");
    const robot = await connectPort(
      discoveredPorts[0].path,
      "so100_follower",
      "calibration_demo"
    );
    console.log(`✅ Connected: ${robot.robotType} (ID: ${robot.robotId})\n`);

    // Step 3: Release motors
    console.log("🔓 Releasing motors for calibration setup...");
    await releaseMotors(robot);
    console.log("✅ Motors released - robot can now be moved by hand");

    console.log("\n📍 Move robot to your preferred starting position...");
    console.log("Press any key to continue...");

    // Simple key press handler without readline conflicts
    process.stdin.setRawMode(true);
    process.stdin.resume();

    await new Promise<void>((resolve) => {
      const onData = () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onData);
        resolve();
      };
      process.stdin.once("data", onData);
    });

    // Step 4: Calibration process
    console.log("\n🎯 Starting calibration process...");
    console.log("This will:");
    console.log("1. Set homing offsets (center positions)");
    console.log("2. Record range of motion for each motor");
    console.log("3. Write position limits to robot hardware");
    console.log("4. Save calibration data for future use\n");

    const calibrationProcess = await calibrate({
      robot,
      onProgress: (message) => {
        console.log(`📊 ${message}`);
      },
      onLiveUpdate: (data) => {
        // Display real-time motor positions and ranges
        const updates = Object.entries(data).map(([name, info]) => {
          const range = info.max - info.min;
          return `${name}: ${info.current} [${info.min}→${info.max}] (range: ${range})`;
        });

        console.clear();
        console.log("🔄 Live Calibration Data:");
        console.log("========================");
        updates.forEach((update) => console.log(`   ${update}`));
        console.log("\n💡 Move each motor through its full range of motion");
        console.log("   Press Enter to complete calibration...");
      },
    });

    // Wait for calibration to complete (it handles user input internally)
    const calibrationData = await calibrationProcess.result;

    console.log("\n✅ Calibration completed successfully!");

    // Display detailed results
    console.log("\n📋 Detailed Calibration Results:");
    console.log("=================================");
    Object.entries(calibrationData).forEach(([motorName, config]) => {
      const range = config.range_max - config.range_min;
      console.log(`${motorName}:`);
      console.log(`   Motor ID: ${config.id}`);
      console.log(`   Drive Mode: ${config.drive_mode}`);
      console.log(`   Homing Offset: ${config.homing_offset}`);
      console.log(
        `   Range: ${config.range_min} → ${config.range_max} (${range} steps)`
      );
      console.log(`   Degrees: ~${((range / 4096) * 360).toFixed(1)}°\n`);
    });

    console.log("💾 Calibration saved to HuggingFace cache directory");
    console.log("🔄 This file is compatible with Python lerobot");

    console.log("\n🎉 Calibration demo completed!");
    console.log("💡 You can now use this calibration data for teleoperation");

    // Ensure process can exit cleanly
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Calibration failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("- Ensure robot is connected and responsive");
    console.log("- Check that motors can move freely during calibration");
    console.log("- Avoid forcing motors past their mechanical limits");
    console.log("- Try restarting the robot if motors become unresponsive");
    process.exit(1);
  }
}

demoCalibrate();

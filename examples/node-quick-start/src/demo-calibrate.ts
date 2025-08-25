/**
 * Calibration Demo
 *
 * Demonstrates robot motor calibration with live feedback
 */

import { findPort, releaseMotors, calibrate } from "@lerobot/node";
import type { RobotConnection } from "@lerobot/node";
import { createInterface } from "readline";

function askUser(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function demoCalibrate() {
  console.log("🎯 Calibration Demo");
  console.log("===================\n");

  try {
    // Step 1: Find connected robot
    console.log("📡 Looking for connected robots...");
    const findProcess = await findPort();
    const robots = await findProcess.result;

    if (robots.length === 0) {
      throw new Error("No robots found. Please connect your robot first.");
    }

    const robot = robots[0] as RobotConnection;
    robot.robotType = "so100_follower";
    robot.robotId = "calibration_demo";

    console.log(`✅ Found robot: ${robot.name} on ${robot.port.path}\n`);

    // Step 2: Release motors
    console.log("🔓 Releasing motors for calibration setup...");
    await releaseMotors(robot);
    console.log("✅ Motors released - robot can now be moved by hand");

    await askUser(
      "\n📍 Move robot to your preferred starting position, then press Enter..."
    );

    // Step 3: Calibration process
    console.log("\n🎯 Starting calibration process...");
    console.log("This will:");
    console.log("1. Set homing offsets (center positions)");
    console.log("2. Record range of motion for each motor");
    console.log("3. Write position limits to robot hardware");
    console.log("4. Save calibration data for future use\n");

    console.log(
      "🔧 TEMP DEBUG: About to call calibrate() function - THIS SHOULD SHOW OUR DEBUG MESSAGES!"
    );
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
        console.log("   Press Enter in the calibration window when complete");
      },
    });

    // Wait for calibration to complete
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

    // Show calibration file location
    const homeDir = require("os").homedir();
    const calibrationPath = `${homeDir}/.cache/huggingface/lerobot/calibration/robots/${robot.robotType}/${robot.robotId}.json`;
    console.log(`💾 Calibration saved to: ${calibrationPath}`);
    console.log("🔄 This file is compatible with Python lerobot");

    console.log("\n🎉 Calibration demo completed!");
    console.log("💡 You can now use this calibration data for teleoperation");
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

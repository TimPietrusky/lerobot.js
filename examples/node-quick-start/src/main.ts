/**
 * Node.js Quick Start Example - Complete Workflow
 *
 * This example demonstrates the full robot control workflow:
 * 1. Find and connect to robot hardware
 * 2. Release motors for manual positioning
 * 3. Calibrate motor ranges and homing positions
 * 4. Control robot with keyboard teleoperation
 */

import {
  findPort,
  connectPort,
  releaseMotors,
  calibrate,
  teleoperate,
} from "@lerobot/node";
import type { RobotConnection, DiscoveredPort } from "@lerobot/node";

// Utility for user confirmation
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

async function quickStartDemo() {
  console.log("🤖 LeRobot.js Node.js Quick Start Demo");
  console.log("=====================================\n");

  try {
    // Step 1: Find available robot ports
    console.log("📡 Step 1: Looking for connected robots...");
    const findProcess = await findPort();
    const discoveredPorts = await findProcess.result;

    if (discoveredPorts.length === 0) {
      throw new Error("No robots found. Please check your connections.");
    }

    console.log(`✅ Found robot on ${discoveredPorts[0].path}`);

    // Step 2: Connect to the first robot found
    console.log("🔌 Step 2: Connecting to robot...");
    const robot = await connectPort(
      discoveredPorts[0].path,
      "so100_follower",
      "demo_robot_arm"
    );
    console.log(`✅ Connected: ${robot.robotType} (ID: ${robot.robotId})\n`);

    // Step 3: Release motors for calibration setup
    const shouldRelease = await askUser(
      "🔓 Release motors for manual positioning? (y/n): "
    );
    if (shouldRelease.toLowerCase() === "y") {
      console.log("🔓 Step 2: Releasing motors...");
      await releaseMotors(robot);
      console.log("✅ Motors released - you can now move the robot by hand\n");

      await askUser(
        "Move robot to desired starting position, then press Enter to continue..."
      );
    }

    // Step 4: Calibrate the robot
    const shouldCalibrate = await askUser("🎯 Run calibration? (y/n): ");
    if (shouldCalibrate.toLowerCase() === "y") {
      console.log("\n🎯 Step 3: Starting calibration...");
      console.log(
        "This will record the motor ranges and set homing positions.\n"
      );

      const calibrationProcess = await calibrate({
        robot: robot as RobotConnection,
        onProgress: (message) => {
          console.log(`   📊 ${message}`);
        },
        onLiveUpdate: (data) => {
          // Show live motor positions during range recording
          const positions = Object.entries(data)
            .map(
              ([name, info]) =>
                `${name}:${info.current}(${info.min}-${info.max})`
            )
            .join(" ");
          process.stdout.write(`\r   🔄 Live: ${positions}`);
        },
      });

      const calibrationData = await calibrationProcess.result;
      console.log("\n✅ Calibration completed!");

      // Show calibration summary
      console.log("\n📋 Calibration Results:");
      Object.entries(calibrationData).forEach(([motorName, config]) => {
        console.log(
          `   ${motorName}: range ${config.range_min}-${config.range_max}, offset ${config.homing_offset}`
        );
      });
    }

    // Step 5: Teleoperation
    const shouldTeleoperate = await askUser(
      "\n🎮 Start keyboard teleoperation? (y/n): "
    );
    if (shouldTeleoperate.toLowerCase() === "y") {
      console.log("\n🎮 Step 4: Starting teleoperation...");
      console.log("Use keyboard to control the robot:\n");

      const teleop = await teleoperate({
        robot: robot as RobotConnection,
        teleop: { type: "keyboard" },
        onStateUpdate: (state) => {
          if (state.isActive) {
            const motorInfo = state.motorConfigs
              .map(
                (motor) => `${motor.name}:${Math.round(motor.currentPosition)}`
              )
              .join(" ");
            process.stdout.write(`\r🤖 Motors: ${motorInfo}`);
          }
        },
      });

      // Start keyboard control
      teleop.start();

      console.log("✅ Teleoperation active!");
      console.log("🎯 Use arrow keys, WASD, Q/E, O/C to control");
      console.log("⚠️  Press ESC for emergency stop, Ctrl+C to exit\n");

      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        console.log("\n🛑 Shutting down teleoperation...");
        teleop.stop();
        await teleop.disconnect();
        console.log("✅ Demo completed successfully!");
        process.exit(0);
      });

      // Keep the demo running
      console.log("Demo is running... Press Ctrl+C to stop");
      await new Promise(() => {}); // Keep alive
    }

    console.log("\n🎉 Quick Start Demo completed!");
    console.log(
      "You can now integrate @lerobot/node into your own applications."
    );
  } catch (error) {
    console.error("\n❌ Demo failed:", error.message);
    console.log("\n🔧 Troubleshooting tips:");
    console.log("- Check robot is connected and powered on");
    console.log("- Verify correct serial port permissions");
    console.log("- Try running 'npx lerobot find-port' to test connection");
    process.exit(1);
  }
}

// Handle uncaught errors gracefully
process.on("uncaughtException", (error) => {
  console.error("\n💥 Unexpected error:", error.message);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  console.error("\n💥 Unhandled promise rejection:", error);
  process.exit(1);
});

// Run the demo
quickStartDemo();

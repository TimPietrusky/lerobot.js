/**
 * Node.js Quick Start Example - Complete Workflow
 *
 * This example demonstrates the full robot control workflow:
 * 1. Find and connect to robot hardware
 * 2. Release motors for manual positioning
 * 3. Calibrate motor ranges and homing positions
 * 4. Control robot with keyboard teleoperation
 */

import { findPort, releaseMotors, calibrate, teleoperate } from "@lerobot/node";
import type { RobotConnection } from "@lerobot/node";

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
    // Step 1: Find connected robot
    console.log("📡 Step 1: Looking for connected robots...");
    const findProcess = await findPort();
    const robots = await findProcess.result;

    if (robots.length === 0) {
      throw new Error("No robots found. Please check your connections.");
    }

    const robot = robots[0];
    console.log(`✅ Found robot: ${robot.name} on ${robot.port.path}`);

    // Configure robot (normally you'd save this configuration)
    robot.robotType = "so100_follower";
    robot.robotId = "demo_robot_arm";

    console.log(
      `🔧 Configured as: ${robot.robotType} (ID: ${robot.robotId})\n`
    );

    // Step 2: Release motors for calibration setup
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

    // Step 3: Calibrate the robot
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

    // Step 4: Teleoperation
    const shouldTeleoperate = await askUser(
      "\n🎮 Start keyboard teleoperation? (y/n): "
    );
    if (shouldTeleoperate.toLowerCase() === "y") {
      console.log("\n🎮 Step 4: Starting teleoperation...");
      console.log("Use keyboard to control the robot:\n");

      const teleop = await teleoperate({
        robot: robot as RobotConnection,
        teleop: { type: "keyboard", stepSize: 25 },
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
    console.log(
      "- Try running 'npx @lerobot/node find-port' to test connection"
    );
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

/**
 * Teleoperation Demo
 *
 * Demonstrates different ways to control robot motors
 */

import { findPort, teleoperate } from "@lerobot/node";
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

async function demoTeleoperate() {
  console.log("🎮 Teleoperation Demo");
  console.log("=====================\n");

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
    robot.robotId = "teleop_demo";

    console.log(`✅ Found robot: ${robot.name} on ${robot.port.path}\n`);

    // Step 2: Choose teleoperation mode
    console.log("🎯 Choose teleoperation mode:");
    console.log("1. Keyboard Control (interactive)");
    console.log("2. Direct Control (programmatic)");

    const mode = await askUser("Enter choice (1 or 2): ");

    if (mode === "1") {
      // Keyboard teleoperation demo
      await demoKeyboardControl(robot);
    } else if (mode === "2") {
      // Direct control demo
      await demoDirectControl(robot);
    } else {
      console.log("Invalid choice. Defaulting to keyboard control...");
      await demoKeyboardControl(robot);
    }
  } catch (error) {
    console.error("\n❌ Teleoperation failed:", error.message);
    console.log("\n🔧 Troubleshooting:");
    console.log("- Ensure robot is calibrated first");
    console.log("- Check that robot is connected and responsive");
    console.log("- Verify calibration data exists");
    console.log("- Try smaller step sizes if movements are too large");
    process.exit(1);
  }
}

async function demoKeyboardControl(robot: RobotConnection) {
  console.log("\n⌨️  Keyboard Control Demo");
  console.log("=========================");
  console.log("\n🎮 Robot Controls:");
  console.log("  Arrow Keys: Shoulder pan/lift");
  console.log("  W/S: Elbow flex/extend");
  console.log("  A/D: Wrist down/up");
  console.log("  Q/E: Wrist roll left/right");
  console.log("  O/C: Gripper open/close");
  console.log("  ESC: Emergency stop");
  console.log("  Ctrl+C: Exit demo\n");

  const teleop = await teleoperate({
    robot,
    teleop: {
      type: "keyboard",
      stepSize: 25, // Small steps for safety
      updateRate: 60, // Smooth control
    },
    onStateUpdate: (state) => {
      if (state.isActive) {
        // Show live motor positions
        const motorInfo = state.motorConfigs
          .map((motor) => {
            const pos = Math.round(motor.currentPosition);
            const percent = (
              ((pos - motor.minPosition) /
                (motor.maxPosition - motor.minPosition)) *
              100
            ).toFixed(0);
            return `${motor.name}:${pos}(${percent}%)`;
          })
          .join(" ");
        process.stdout.write(`\r🤖 ${motorInfo}`);
      }
    },
  });

  // Start keyboard control
  teleop.start();
  console.log("✅ Keyboard control active!");
  console.log("💡 Move robot with keyboard, press Ctrl+C to exit");

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n🛑 Stopping keyboard control...");
    teleop.stop();
    await teleop.disconnect();
    console.log("✅ Keyboard control demo completed!");
    process.exit(0);
  });

  // Keep demo running
  await new Promise(() => {}); // Keep alive
}

async function demoDirectControl(robot: RobotConnection) {
  console.log("\n🎯 Direct Control Demo");
  console.log("======================");
  console.log("This demonstrates programmatic robot control\n");

  const teleop = await teleoperate({
    robot,
    teleop: { type: "direct" },
    onStateUpdate: (state) => {
      const motorInfo = state.motorConfigs
        .map((motor) => `${motor.name}:${Math.round(motor.currentPosition)}`)
        .join(" ");
      console.log(`🤖 ${motorInfo}`);
    },
  });

  teleop.start();

  // Get direct control interface
  const directController = teleop.teleoperator as any;

  console.log("🎬 Running automated movement sequence...\n");

  try {
    // Demo sequence: move different motors
    const movements = [
      {
        motor: "shoulder_pan",
        position: 2048,
        description: "Center shoulder pan",
      },
      { motor: "shoulder_lift", position: 1500, description: "Lift shoulder" },
      { motor: "elbow_flex", position: 2500, description: "Flex elbow" },
      { motor: "wrist_flex", position: 2000, description: "Adjust wrist" },
      { motor: "wrist_roll", position: 2048, description: "Center wrist roll" },
      { motor: "gripper", position: 1800, description: "Adjust gripper" },
    ];

    for (const movement of movements) {
      console.log(`🎯 ${movement.description}...`);
      await directController.moveMotor(movement.motor, movement.position);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
    }

    console.log("\n🎉 Movement sequence completed!");

    // Demo multi-motor movement
    console.log("\n🎭 Demonstrating simultaneous multi-motor movement...");
    const results = await directController.moveMotors({
      shoulder_pan: 2048,
      shoulder_lift: 2048,
      elbow_flex: 2048,
      wrist_flex: 2048,
    });

    console.log("📊 Movement results:");
    Object.entries(results).forEach(([motor, success]) => {
      console.log(`   ${motor}: ${success ? "✅" : "❌"}`);
    });

    // Show current positions
    const positions = directController.getCurrentPositions();
    console.log("\n📍 Final positions:");
    Object.entries(positions).forEach(([motor, position]) => {
      console.log(`   ${motor}: ${Math.round(position as number)}`);
    });
  } finally {
    console.log("\n🛑 Stopping direct control...");
    teleop.stop();
    await teleop.disconnect();
    console.log("✅ Direct control demo completed!");
  }
}

demoTeleoperate();

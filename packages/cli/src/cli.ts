#!/usr/bin/env node

/**
 * lerobot CLI - Python lerobot compatible command-line interface
 * Uses @lerobot/node library for core functionality with CLI-specific interactive features
 */

import { program } from "commander";
import chalk from "chalk";
import {
  findPort,
  calibrate,
  teleoperate,
  releaseMotors,
  connectPort,
} from "@lerobot/node";
import type { RobotConnection } from "@lerobot/node";
import { SerialPort } from "serialport";
import { createInterface } from "readline";
import { platform } from "os";
import { readdir } from "fs/promises";
import { join } from "path";

/**
 * CLI-specific function to list available serial ports
 * Only used by the CLI, not part of the library API
 */
async function findAvailablePorts(): Promise<string[]> {
  if (platform() === "win32") {
    // List COM ports using serialport library (equivalent to pyserial)
    const ports = await SerialPort.list();
    return ports.map((port) => port.path);
  } else {
    // List /dev/tty* ports for Unix-based systems (Linux/macOS)
    try {
      const devFiles = await readdir("/dev");
      const ttyPorts = devFiles
        .filter((file) => file.startsWith("tty"))
        .map((file) => join("/dev", file));
      return ttyPorts;
    } catch (error) {
      // Fallback to serialport library if /dev reading fails
      const ports = await SerialPort.list();
      return ports.map((port) => port.path);
    }
  }
}

/**
 * CLI-specific interactive port detection for Python lerobot compatibility
 * Matches Python lerobot's unplug/replug cable detection exactly
 */
async function detectPortInteractive(
  onMessage?: (message: string) => void
): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function waitForInput(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      rl.question(prompt, (answer: string) => {
        resolve(answer);
      });
    });
  }

  try {
    const message = "Finding all available ports for the MotorsBus.";
    if (onMessage) onMessage(message);
    else console.log(message);

    // Get initial port list
    const portsBefore = await findAvailablePorts();

    // Show initial ports (Python lerobot style)
    const portsMessage = `Ports before disconnecting: [${portsBefore
      .map((p) => `'${p}'`)
      .join(", ")}]`;
    if (onMessage) onMessage(portsMessage);
    else console.log(portsMessage);

    const disconnectPrompt =
      "Remove the USB cable from your MotorsBus and press Enter when done.";
    await waitForInput(disconnectPrompt);

    // Get port list after disconnect
    const portsAfter = await findAvailablePorts();

    // Find the difference
    const portsDiff = portsBefore.filter((port) => !portsAfter.includes(port));

    if (portsDiff.length === 1) {
      const detectedPort = portsDiff[0];

      // Show empty line then the result (Python lerobot style)
      if (onMessage) {
        onMessage("");
        onMessage(`The port of this MotorsBus is '${detectedPort}'`);
        onMessage("Reconnect the USB cable.");
      } else {
        console.log("");
        console.log(`The port of this MotorsBus is '${detectedPort}'`);
        console.log("Reconnect the USB cable.");
      }

      return detectedPort;
    } else if (portsDiff.length === 0) {
      throw new Error(
        "No port difference detected. Please check cable connection."
      );
    } else {
      throw new Error(
        `Multiple ports detected: ${portsDiff.join(
          ", "
        )}. Please disconnect other devices.`
      );
    }
  } finally {
    rl.close();
  }
}

/**
 * Create robot connection directly from specified port (Python lerobot style)
 */
async function connectToSpecificPort(
  portPath: string,
  robotType: string,
  robotId: string
): Promise<RobotConnection> {
  console.log(chalk.gray(`📡 Connecting to ${portPath}...`));

  const connection = await connectPort(portPath);

  if (!connection.isConnected) {
    throw new Error(
      `Failed to connect to port ${portPath}: ${connection.error}`
    );
  }

  // Configure the robot with CLI parameters
  connection.robotType = robotType;
  connection.robotId = robotId;
  connection.name = `${robotType} on ${portPath}`;

  console.log(chalk.green(`✅ Connected to ${robotType} on ${portPath}`));
  return connection;
}

/**
 * Find port command - matches Python lerobot CLI exactly
 * Always interactive by default (like Python lerobot)
 */
program
  .command("find-port")
  .description("Find robot port with interactive cable detection")
  .addHelpText(
    "after",
    `
Examples:
  $ lerobot find-port

This command will:
  1. List current ports
  2. Ask you to unplug your robot
  3. Detect which port disappeared
  4. Ask you to reconnect
`
  )
  .action(async () => {
    try {
      console.log(chalk.blue("🔍 Finding robot port..."));

      // Always use interactive cable detection (Python lerobot behavior)
      await detectPortInteractive((message) =>
        console.log(chalk.gray(message))
      );
      // No additional success message - detectPortInteractive already shows the result
    } catch (error) {
      console.error(
        chalk.red(`❌ Error: ${error instanceof Error ? error.message : error}`)
      );
      process.exit(1);
    }
  });

/**
 * Calibrate command - matches Python lerobot exactly
 */
program
  .command("calibrate")
  .description("Calibrate robot motors")
  .requiredOption("--robot.type <type>", "Robot type (e.g., so100_follower)")
  .requiredOption(
    "--robot.port <port>",
    "Serial port (e.g., /dev/ttyUSB0, COM4)"
  )
  .option("--robot.id <id>", "Robot ID", "default")
  .option("--output <path>", "Output calibration file path")
  .addHelpText(
    "after",
    `
Examples:
  $ lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
  $ lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=production_arm
`
  )
  .action(async (options) => {
    try {
      const robotType = options["robot.type"];
      const robotPort = options["robot.port"];
      const robotId = options["robot.id"] || "default";

      console.log(chalk.blue(`🔧 Starting calibration for ${robotType}...`));

      // Step 1: Connect directly to specified port (Python lerobot style)
      const robot = await connectToSpecificPort(robotPort, robotType, robotId);

      // Step 2: Release motors
      console.log(chalk.gray("🔓 Releasing motors for calibration setup..."));
      await releaseMotors(robot);
      console.log(
        chalk.green("✅ Motors released - robot can now be moved by hand")
      );

      // Step 3: Wait for user to position robot
      console.log(
        chalk.yellow(
          "\n📍 Move robot to your preferred starting position, then press Enter..."
        )
      );
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      await new Promise<void>((resolve) => {
        rl.question("", () => {
          rl.close();
          resolve();
        });
      });

      console.log(chalk.blue("\n🎯 Starting calibration process..."));
      const calibrationProcess = await calibrate({
        robot,
        outputPath: options.output,
        onProgress: (message) => console.log(chalk.gray(message)),
        onLiveUpdate: (data) => {
          // Clear previous output and display live data as table
          process.stdout.write("\x1B[2J\x1B[0f"); // Clear screen and move cursor to top

          console.log(chalk.cyan("📊 Live Motor Data:"));
          console.log(
            "┌─────────────────┬─────────┬─────────┬─────────┬─────────┐"
          );
          console.log(
            "│ Motor           │ Current │ Min     │ Max     │ Range   │"
          );
          console.log(
            "├─────────────────┼─────────┼─────────┼─────────┼─────────┤"
          );

          Object.entries(data).forEach(([name, info]) => {
            const motorName = name.padEnd(15);
            const current = info.current.toString().padStart(7);
            const min = info.min.toString().padStart(7);
            const max = info.max.toString().padStart(7);
            const range = info.range.toString().padStart(7);
            console.log(
              `│ ${motorName} │ ${current} │ ${min} │ ${max} │ ${range} │`
            );
          });

          console.log(
            "└─────────────────┴─────────┴─────────┴─────────┴─────────┘"
          );
          console.log(
            chalk.yellow(
              "Move motors through full range, then press Enter when done..."
            )
          );
        },
      });

      const results = await calibrationProcess.result;
      console.log(chalk.green("\n✅ Calibration completed successfully!"));

      // CRITICAL: Close robot connection to allow process to exit
      if (robot.port && robot.port.close) {
        await robot.port.close();
      }
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Calibration failed: ${
            error instanceof Error ? error.message : error
          }`
        )
      );

      // Close robot connection even on error
      try {
        if (robot && robot.port && robot.port.close) {
          await robot.port.close();
        }
      } catch (closeError) {
        // Ignore close errors
      }

      process.exit(1);
    }
  });

/**
 * Teleoperate command - matches Python lerobot exactly
 */
program
  .command("teleoperate")
  .alias("teleop")
  .description("Control robot through teleoperation")
  .requiredOption("--robot.type <type>", "Robot type (e.g., so100_follower)")
  .requiredOption(
    "--robot.port <port>",
    "Serial port (e.g., /dev/ttyUSB0, COM4)"
  )
  .option("--robot.id <id>", "Robot ID", "default")
  .option("--teleop.type <type>", "Teleoperator type", "keyboard")
  .option("--duration <seconds>", "Duration in seconds (0 = unlimited)", "0")
  .addHelpText(
    "after",
    `
Examples:
  $ lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
  $ lerobot teleop --robot.type=so100_follower --robot.port=COM4 --robot.id=my_arm --duration=60

Controls:
  w/s - Motor 1    q/e - Motor 3    t/g - Motor 5
  a/d - Motor 2    r/f - Motor 4    y/h - Motor 6
  Ctrl+C - Stop and exit
`
  )
  .action(async (options) => {
    try {
      const robotType = options["robot.type"];
      const robotPort = options["robot.port"];
      const robotId = options["robot.id"] || "default";
      const teleopType = options["teleop.type"] || "keyboard";

      console.log(chalk.blue(`🎮 Starting teleoperation for ${robotType}...`));

      // Connect directly to specified port (Python lerobot style)
      const robot = await connectToSpecificPort(robotPort, robotType, robotId);

      const teleoperationProcess = await teleoperate({
        robot,
        teleop: {
          type: teleopType,
        },
        onStateUpdate: (state) => {
          if (state.isActive) {
            const motorInfo = state.motorConfigs
              .map(
                (motor) => `${motor.name}:${Math.round(motor.currentPosition)}`
              )
              .join(" ");
            process.stdout.write(`\r${chalk.cyan("🤖 Motors:")} ${motorInfo}`);
          }
        },
      });

      // Start teleoperation
      teleoperationProcess.start();

      // Handle duration limit
      const duration = parseInt(options.duration || "0");
      if (duration > 0) {
        setTimeout(() => {
          console.log(
            chalk.yellow(
              `\n⏰ Duration limit reached (${duration}s). Stopping...`
            )
          );
          teleoperationProcess.stop();
          process.exit(0);
        }, duration * 1000);
      }

      // Handle process termination
      process.on("SIGINT", async () => {
        console.log(chalk.yellow("\n🛑 Stopping teleoperation..."));
        teleoperationProcess.stop();
        await teleoperationProcess.disconnect();
        process.exit(0);
      });

      console.log(chalk.green("✅ Teleoperation started successfully!"));
      console.log(chalk.gray("Press Ctrl+C to stop"));
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Teleoperation failed: ${
            error instanceof Error ? error.message : error
          }`
        )
      );
      process.exit(1);
    }
  });

/**
 * Release motors command
 */
program
  .command("release-motors")
  .description("Release robot motors for manual movement")
  .requiredOption("--robot.type <type>", "Robot type (e.g., so100_follower)")
  .requiredOption(
    "--robot.port <port>",
    "Serial port (e.g., /dev/ttyUSB0, COM4)"
  )
  .option("--robot.id <id>", "Robot ID", "default")
  .option("--motors <ids>", "Specific motor IDs to release (comma-separated)")
  .addHelpText(
    "after",
    `
Examples:
  $ lerobot release-motors --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm
  $ lerobot release-motors --robot.type=so100_follower --robot.port=COM4 --robot.id=my_arm --motors=1,2,3
`
  )
  .action(async (options) => {
    try {
      const robotType = options["robot.type"];
      const robotPort = options["robot.port"];
      const robotId = options["robot.id"] || "default";

      console.log(chalk.blue(`🔓 Releasing motors for ${robotType}...`));

      // Connect directly to specified port (Python lerobot style)
      const robot = await connectToSpecificPort(robotPort, robotType, robotId);

      const motorIds = options.motors
        ? options.motors.split(",").map((id: string) => parseInt(id.trim()))
        : undefined;

      await releaseMotors(robot, motorIds);

      console.log(chalk.green("✅ Motors released successfully!"));
      console.log(chalk.gray("Motors can now be moved freely by hand."));
    } catch (error) {
      console.error(
        chalk.red(
          `❌ Failed to release motors: ${
            error instanceof Error ? error.message : error
          }`
        )
      );
      process.exit(1);
    }
  });

/**
 * Version and help setup
 */
program
  .name("lerobot")
  .description(
    "Control your robot with Node.js (inspired by LeRobot in Python)"
  )
  .version("0.1.0")
  .addHelpText(
    "after",
    `
    `
  );

/**
 * Parse CLI arguments and run
 */
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

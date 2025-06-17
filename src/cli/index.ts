#!/usr/bin/env node

/**
 * lerobot.js CLI
 *
 * Provides command-line interface for lerobot functionality
 * Maintains compatibility with Python lerobot command structure
 */

import { findPort } from "../lerobot/node/find_port.js";
import { main as calibrateMain } from "../lerobot/node/calibrate.js";

/**
 * Show usage information
 */
function showUsage() {
  console.log("Usage: lerobot <command>");
  console.log("");
  console.log("Commands:");
  console.log(
    "  find-port    Find the USB port associated with your MotorsBus"
  );
  console.log("  calibrate    Recalibrate your device (robot or teleoperator)");
  console.log("");
  console.log("Examples:");
  console.log("  lerobot find-port");
  console.log(
    "  lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm"
  );
  console.log("");
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showUsage();
    process.exit(1);
  }

  const command = args[0];

  try {
    switch (command) {
      case "find-port":
        await findPort();
        break;

      case "calibrate":
        // Pass remaining arguments to calibrate command
        const calibrateArgs = args.slice(1);
        await calibrateMain(calibrateArgs);
        break;

      case "help":
      case "--help":
      case "-h":
        showUsage();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run the CLI
main();

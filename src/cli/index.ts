#!/usr/bin/env node

/**
 * lerobot.js CLI
 *
 * Provides command-line interface for lerobot functionality
 * Maintains compatibility with Python lerobot command structure
 */

import { findPort } from "../lerobot/find_port.js";

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
  console.log("");
  console.log("Examples:");
  console.log("  lerobot find-port");
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

/**
 * Helper to recalibrate your device (robot or teleoperator).
 *
 * Example:
 * ```
 * npx lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm
 * ```
 */

import { createSO100Follower } from "./robots/so100_follower.js";
import { createSO100Leader } from "./teleoperators/so100_leader.js";
import {
  initializeDeviceCommunication,
  readMotorPositions,
  performInteractiveCalibration,
  setMotorLimits,
  verifyCalibration,
} from "./common/calibration.js";
import type { CalibrateConfig } from "./types/robot-config.js";
import type { CalibrationResults } from "./types/calibration.js";
import { getSO100Config } from "./common/so100_config.js";

/**
 * Main calibrate function
 * Mirrors Python lerobot calibrate.py calibrate() function
 * Uses shared calibration procedures instead of device-specific implementations
 */
export async function calibrate(config: CalibrateConfig): Promise<void> {
  // Validate configuration - exactly one device must be specified
  if (Boolean(config.robot) === Boolean(config.teleop)) {
    throw new Error("Choose either a robot or a teleop.");
  }

  const deviceConfig = config.robot || config.teleop!;

  let device;
  let calibrationResults: CalibrationResults;

  try {
    // Create device for connection management only
    if (config.robot) {
      switch (config.robot.type) {
        case "so100_follower":
          device = createSO100Follower(config.robot);
          break;
        default:
          throw new Error(`Unsupported robot type: ${config.robot.type}`);
      }
    } else if (config.teleop) {
      switch (config.teleop.type) {
        case "so100_leader":
          device = createSO100Leader(config.teleop);
          break;
        default:
          throw new Error(
            `Unsupported teleoperator type: ${config.teleop.type}`
          );
      }
    }

    if (!device) {
      throw new Error("Failed to create device");
    }

    // Connect to device (silent unless error)
    await device.connect(false); // calibrate=False like Python

    // Get SO-100 calibration configuration
    const so100Config = getSO100Config(
      deviceConfig.type as "so100_follower" | "so100_leader",
      (device as any).port
    );

    // Perform shared calibration procedures (silent unless error)
    await initializeDeviceCommunication(so100Config);
    await setMotorLimits(so100Config);

    // Interactive calibration with live updates - THE MAIN PART
    calibrationResults = await performInteractiveCalibration(so100Config);

    // Save and cleanup (silent unless error)
    await verifyCalibration(so100Config);
    await (device as any).saveCalibration(calibrationResults);
    await device.disconnect();
  } catch (error) {
    // Ensure we disconnect even if there's an error
    if (device) {
      try {
        await device.disconnect();
      } catch (disconnectError) {
        console.warn("Warning: Failed to disconnect properly");
      }
    }
    throw error;
  }
}

/**
 * Parse command line arguments in Python argparse style
 * Handles --robot.type=so100_follower --robot.port=COM4 format
 */
export function parseArgs(args: string[]): CalibrateConfig {
  const config: CalibrateConfig = {};

  for (const arg of args) {
    if (arg.startsWith("--robot.")) {
      if (!config.robot) {
        config.robot = { type: "so100_follower", port: "" };
      }

      const [key, value] = arg.substring(8).split("=");
      switch (key) {
        case "type":
          if (value !== "so100_follower") {
            throw new Error(`Unsupported robot type: ${value}`);
          }
          config.robot.type = value as "so100_follower";
          break;
        case "port":
          config.robot.port = value;
          break;
        case "id":
          config.robot.id = value;
          break;
        case "disable_torque_on_disconnect":
          config.robot.disable_torque_on_disconnect = value === "true";
          break;
        case "max_relative_target":
          config.robot.max_relative_target = value ? parseInt(value) : null;
          break;
        case "use_degrees":
          config.robot.use_degrees = value === "true";
          break;
        default:
          throw new Error(`Unknown robot parameter: ${key}`);
      }
    } else if (arg.startsWith("--teleop.")) {
      if (!config.teleop) {
        config.teleop = { type: "so100_leader", port: "" };
      }

      const [key, value] = arg.substring(9).split("=");
      switch (key) {
        case "type":
          if (value !== "so100_leader") {
            throw new Error(`Unsupported teleoperator type: ${value}`);
          }
          config.teleop.type = value as "so100_leader";
          break;
        case "port":
          config.teleop.port = value;
          break;
        case "id":
          config.teleop.id = value;
          break;
        default:
          throw new Error(`Unknown teleoperator parameter: ${key}`);
      }
    } else if (arg === "--help" || arg === "-h") {
      showUsage();
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      // Skip non-option arguments
      continue;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  // Validate required fields
  if (config.robot && !config.robot.port) {
    throw new Error("Robot port is required (--robot.port=PORT)");
  }
  if (config.teleop && !config.teleop.port) {
    throw new Error("Teleoperator port is required (--teleop.port=PORT)");
  }

  return config;
}

/**
 * Show usage information matching Python argparse output
 */
function showUsage(): void {
  console.log("Usage: lerobot calibrate [options]");
  console.log("");
  console.log("Recalibrate your device (robot or teleoperator)");
  console.log("");
  console.log("Options:");
  console.log("  --robot.type=TYPE        Robot type (so100_follower)");
  console.log(
    "  --robot.port=PORT        Robot serial port (e.g., COM4, /dev/ttyUSB0)"
  );
  console.log("  --robot.id=ID            Robot identifier");
  console.log("  --teleop.type=TYPE       Teleoperator type (so100_leader)");
  console.log("  --teleop.port=PORT       Teleoperator serial port");
  console.log("  --teleop.id=ID           Teleoperator identifier");
  console.log("  -h, --help               Show this help message");
  console.log("");
  console.log("Examples:");
  console.log(
    "  lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm"
  );
  console.log(
    "  lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm"
  );
  console.log("");
  console.log("Use 'lerobot find-port' to discover available ports.");
}

/**
 * CLI entry point when called directly
 * Mirrors Python's if __name__ == "__main__": pattern
 */
export async function main(args: string[]): Promise<void> {
  try {
    if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
      showUsage();
      return;
    }

    const config = parseArgs(args);
    await calibrate(config);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Error:", error);
    }

    console.error("");
    console.error("Please verify:");
    console.error("1. The device is connected to the specified port");
    console.error("2. No other application is using the port");
    console.error("3. You have permission to access the port");
    console.error("");
    console.error("Use 'lerobot find-port' to discover available ports.");

    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  main(args);
}

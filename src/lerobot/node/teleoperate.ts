/**
 * Robot teleoperation using keyboard control
 *
 * Direct port of Python lerobot teleoperate.py (keyboard portion)
 *
 * Example:
 * ```
 * npx lerobot teleoperate --robot.type=so100_follower --robot.port=COM4 --teleop.type=keyboard
 * ```
 */

import type { RobotConfig } from "./robots/config.js";
import { createSO100Follower } from "./robots/so100_follower.js";
import { KeyboardController } from "./keyboard_teleop.js";

/**
 * Teleoperate configuration interface
 * Matches Python lerobot teleoperate argument structure
 */
export interface TeleoperateConfig {
  robot: RobotConfig;
  teleop: TeleoperatorConfig;
  fps?: number; // Default: 60
  step_size?: number; // Default: 10 (motor position units)
  duration_s?: number | null; // Default: null (infinite)
}

export interface TeleoperatorConfig {
  type: "keyboard"; // Only keyboard for now, expandable later
}

/**
 * Main teleoperate function
 * Mirrors Python lerobot teleoperate.py structure
 */
export async function teleoperate(config: TeleoperateConfig): Promise<void> {
  // Validate configuration
  if (!config.robot) {
    throw new Error("Robot configuration is required");
  }

  if (!config.teleop || config.teleop.type !== "keyboard") {
    throw new Error("Only keyboard teleoperation is currently supported");
  }

  const fps = config.fps || 60;
  const stepSize = config.step_size || 25;
  const duration = config.duration_s;

  let robot;
  let keyboardController;

  try {
    // Create robot
    switch (config.robot.type) {
      case "so100_follower":
        robot = createSO100Follower(config.robot);
        break;
      default:
        throw new Error(`Unsupported robot type: ${config.robot.type}`);
    }

    console.log(
      `Connecting to robot: ${config.robot.type} on ${config.robot.port}`
    );
    if (config.robot.id) {
      console.log(`Robot ID: ${config.robot.id}`);
    }

    await robot.connect(false); // calibrate=false
    console.log("Robot connected successfully.");

    // Show calibration status
    const isCalibrated = (robot as any).isCalibrated;
    if (isCalibrated) {
      console.log(
        `✅ Loaded calibration for: ${config.robot.id || config.robot.type}`
      );
    } else {
      console.log(
        `⚠️  No calibration found for: ${
          config.robot.id || config.robot.type
        } (using defaults)`
      );
      console.log(
        "   Run 'npx lerobot calibrate' first for optimal performance!"
      );
    }

    // Create keyboard controller
    keyboardController = new KeyboardController(robot, stepSize);

    console.log("");
    console.log("Starting keyboard teleoperation...");
    console.log("Controls:");
    console.log("  ↑↓ Arrow Keys: Shoulder Lift");
    console.log("  ←→ Arrow Keys: Shoulder Pan");
    console.log("  W/S: Elbow Flex");
    console.log("  A/D: Wrist Flex");
    console.log("  Q/E: Wrist Roll");
    console.log("  Space: Gripper Toggle");
    console.log("  ESC: Emergency Stop");
    console.log("  Ctrl+C: Exit");
    console.log("");
    console.log("Press any control key to begin...");
    console.log("");

    // Start teleoperation control loop
    await teleoperationLoop(keyboardController, robot, fps, duration || null);
  } catch (error) {
    // Ensure we disconnect even if there's an error
    if (keyboardController) {
      try {
        await keyboardController.stop();
      } catch (stopError) {
        console.warn("Warning: Failed to stop keyboard controller properly");
      }
    }
    if (robot) {
      try {
        await robot.disconnect();
      } catch (disconnectError) {
        console.warn("Warning: Failed to disconnect robot properly");
      }
    }
    throw error;
  }
}

/**
 * Main teleoperation control loop
 * Provides real-time position feedback and performance metrics
 */
async function teleoperationLoop(
  keyboardController: KeyboardController,
  robot: any,
  fps: number,
  duration: number | null
): Promise<void> {
  console.log("Initializing teleoperation...");

  // Start keyboard controller
  await keyboardController.start();

  const startTime = performance.now();
  let loopCount = 0;

  // Set up graceful shutdown
  let running = true;
  process.on("SIGINT", () => {
    console.log("\nShutting down gracefully...");
    running = false;
  });

  try {
    // Just wait for the keyboard controller to handle everything
    while (running) {
      // Check duration limit
      if (duration && performance.now() - startTime >= duration * 1000) {
        console.log(`\nDuration limit reached (${duration}s). Stopping...`);
        break;
      }

      // Small delay to prevent busy waiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } finally {
    console.log("\nStopping teleoperation...");
    await keyboardController.stop();
    await robot.disconnect();
    console.log("Teleoperation stopped.");
  }
}

/**
 * Display current robot status
 * Shows positions, ranges, and performance metrics
 */
function displayStatus(
  positions: Record<string, number>,
  loopCount: number,
  avgLoopTime: number
): void {
  // Clear screen and show current status
  console.clear();
  console.log("=== KEYBOARD TELEOPERATION ===");
  console.log("");

  console.log("Current Positions:");
  for (const [motor, position] of Object.entries(positions)) {
    console.log(`${motor}: ${Math.round(position)}`);
  }

  console.log("");
  const fps = loopCount > 0 ? 1000 / avgLoopTime : 0;
  console.log(
    `Loop: ${avgLoopTime.toFixed(2)}ms (${fps.toFixed(
      0
    )} Hz) | Status: Connected`
  );
  console.log("");
  console.log("Use arrow keys, WASD, Q/E, Space to control. ESC to stop.");
}

/**
 * Parse command line arguments in Python argparse style
 * Handles --robot.type=so100_follower --teleop.type=keyboard format
 */
export function parseArgs(args: string[]): TeleoperateConfig {
  const config: Partial<TeleoperateConfig> = {};

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
        default:
          throw new Error(`Unknown robot parameter: ${key}`);
      }
    } else if (arg.startsWith("--teleop.")) {
      if (!config.teleop) {
        config.teleop = { type: "keyboard" };
      }

      const [key, value] = arg.substring(9).split("=");
      switch (key) {
        case "type":
          if (value !== "keyboard") {
            throw new Error(`Unsupported teleoperator type: ${value}`);
          }
          config.teleop.type = value as "keyboard";
          break;
        default:
          throw new Error(`Unknown teleoperator parameter: ${key}`);
      }
    } else if (arg.startsWith("--fps=")) {
      config.fps = parseInt(arg.substring(6));
      if (isNaN(config.fps) || config.fps <= 0) {
        throw new Error("FPS must be a positive number");
      }
    } else if (arg.startsWith("--step_size=")) {
      config.step_size = parseInt(arg.substring(12));
      if (isNaN(config.step_size) || config.step_size <= 0) {
        throw new Error("Step size must be a positive number");
      }
    } else if (arg.startsWith("--duration_s=")) {
      config.duration_s = parseInt(arg.substring(13));
      if (isNaN(config.duration_s) || config.duration_s <= 0) {
        throw new Error("Duration must be a positive number");
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
  if (!config.robot?.port) {
    throw new Error("Robot port is required (--robot.port=PORT)");
  }
  if (!config.teleop?.type) {
    throw new Error("Teleoperator type is required (--teleop.type=keyboard)");
  }

  return config as TeleoperateConfig;
}

/**
 * Show usage information matching Python argparse output
 */
function showUsage(): void {
  console.log("Usage: lerobot teleoperate [options]");
  console.log("");
  console.log("Control a robot using keyboard input");
  console.log("");
  console.log("Options:");
  console.log("  --robot.type=TYPE        Robot type (so100_follower)");
  console.log(
    "  --robot.port=PORT        Robot serial port (e.g., COM4, /dev/ttyUSB0)"
  );
  console.log("  --robot.id=ID            Robot identifier");
  console.log("  --teleop.type=TYPE       Teleoperator type (keyboard)");
  console.log(
    "  --fps=FPS                Control loop frame rate (default: 60)"
  );
  console.log(
    "  --step_size=SIZE         Position step size per keypress (default: 10)"
  );
  console.log("  --duration_s=SECONDS     Teleoperation duration in seconds");
  console.log("  -h, --help               Show this help message");
  console.log("");
  console.log("Keyboard Controls:");
  console.log("  ↑↓ Arrow Keys            Shoulder Lift");
  console.log("  ←→ Arrow Keys            Shoulder Pan");
  console.log("  W/S                      Elbow Flex");
  console.log("  A/D                      Wrist Flex");
  console.log("  Q/E                      Wrist Roll");
  console.log("  Space                    Gripper Toggle");
  console.log("  ESC                      Emergency Stop");
  console.log("  Ctrl+C                   Exit");
  console.log("");
  console.log("Examples:");
  console.log(
    "  lerobot teleoperate --robot.type=so100_follower --robot.port=COM4 --teleop.type=keyboard"
  );
  console.log(
    "  lerobot teleoperate --robot.type=so100_follower --robot.port=COM4 --teleop.type=keyboard --fps=30 --step_size=50"
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
    await teleoperate(config);
  } catch (error) {
    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error("Error:", error);
    }

    console.error("");
    console.error("Please verify:");
    console.error("1. The robot is connected to the specified port");
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

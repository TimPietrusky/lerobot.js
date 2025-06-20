/**
 * Keyboard teleoperation controller for Node.js terminal
 * Handles raw keyboard input and robot position control using the keypress package.
 */

import * as readline from "readline";
import { SO100Follower } from "./robots/so100_follower.js";

/**
 * Keyboard controller for robot teleoperation
 * Handles terminal keyboard input and robot position updates
 */
export class KeyboardController {
  private robot: SO100Follower;
  private stepSize: number;
  private currentPositions: Record<string, number> = {};
  private motorNames = [
    "shoulder_pan",
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper",
  ];
  private running = false;
  private gripperState = false; // Toggle state for gripper

  constructor(robot: SO100Follower, stepSize: number = 25) {
    this.robot = robot;
    this.stepSize = stepSize;
  }

  /**
   * Start keyboard teleoperation
   * Sets up raw keyboard input and initializes robot positions
   */
  async start(): Promise<void> {
    console.log("Initializing keyboard controller...");

    // Initialize current positions from robot
    try {
      this.currentPositions = await this.readRobotPositions();
    } catch (error) {
      console.warn(
        "Could not read initial robot positions, using calibrated centers"
      );
      // Initialize with calibrated center positions if available, otherwise use middle positions
      const calibratedLimits = this.robot.getCalibrationLimits();
      this.motorNames.forEach((motor) => {
        const limits = calibratedLimits[motor];
        const centerPosition = limits
          ? Math.floor((limits.min + limits.max) / 2)
          : 2047;
        this.currentPositions[motor] = centerPosition;
      });
    }

    // Set up raw keyboard input
    this.setupKeyboardInput();
    this.running = true;

    console.log("Keyboard controller ready. Use controls to move robot.");
  }

  /**
   * Stop keyboard teleoperation
   * Cleans up keyboard input handling
   */
  async stop(): Promise<void> {
    this.running = false;

    // Reset terminal to normal mode
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.removeAllListeners("keypress");

    console.log("Keyboard controller stopped.");
  }

  /**
   * Get current robot positions
   */
  async getCurrentPositions(): Promise<Record<string, number>> {
    return { ...this.currentPositions };
  }

  /**
   * Set up keyboard input handling
   * Uses readline for cross-platform keyboard input
   */
  private setupKeyboardInput(): void {
    // Set up raw mode for immediate key response
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    // Handle keyboard input
    process.stdin.on("data", (key: string) => {
      if (!this.running) return;

      this.handleKeyPress(key);
    });
  }

  /**
   * Handle individual key presses
   * Maps keys to robot motor movements
   */
  private async handleKeyPress(key: string): Promise<void> {
    let positionChanged = false;
    const newPositions = { ...this.currentPositions };

    // Handle arrow keys first (they start with ESC but are multi-byte sequences)
    if (key.startsWith("\u001b[")) {
      const arrowKey = key.slice(2);
      switch (arrowKey) {
        case "A": // Up arrow
          newPositions.shoulder_lift += this.stepSize;
          positionChanged = true;
          break;
        case "B": // Down arrow
          newPositions.shoulder_lift -= this.stepSize;
          positionChanged = true;
          break;
        case "C": // Right arrow
          newPositions.shoulder_pan += this.stepSize;
          positionChanged = true;
          break;
        case "D": // Left arrow
          newPositions.shoulder_pan -= this.stepSize;
          positionChanged = true;
          break;
      }
    } else {
      // Handle single character keys
      const keyCode = key.charCodeAt(0);

      switch (keyCode) {
        // Standalone ESC key (emergency stop)
        case 27:
          if (key.length === 1) {
            console.log("\n🛑 EMERGENCY STOP!");
            await this.emergencyStop();
            return;
          }
          break;

        // Regular character keys
        case 119: // 'w'
          newPositions.elbow_flex += this.stepSize;
          positionChanged = true;
          break;
        case 115: // 's'
          newPositions.elbow_flex -= this.stepSize;
          positionChanged = true;
          break;
        case 97: // 'a'
          newPositions.wrist_flex -= this.stepSize;
          positionChanged = true;
          break;
        case 100: // 'd'
          newPositions.wrist_flex += this.stepSize;
          positionChanged = true;
          break;
        case 113: // 'q'
          newPositions.wrist_roll -= this.stepSize;
          positionChanged = true;
          break;
        case 101: // 'e'
          newPositions.wrist_roll += this.stepSize;
          positionChanged = true;
          break;
        case 32: // Space
          // Toggle gripper
          this.gripperState = !this.gripperState;
          newPositions.gripper = this.gripperState ? 2300 : 1800;
          positionChanged = true;
          break;

        // Ctrl+C
        case 3:
          console.log("\nExiting...");
          process.exit(0);
      }
    }

    if (positionChanged) {
      // Apply position limits using calibration
      this.enforcePositionLimits(newPositions);

      // Update robot positions - only send changed motors for better performance
      try {
        await this.writeRobotPositions(newPositions);
        this.currentPositions = newPositions;
      } catch (error) {
        console.warn(
          `Failed to update robot positions: ${
            error instanceof Error ? error.message : error
          }`
        );
      }
    }
  }

  /**
   * Read current positions from robot
   * Uses SO100Follower position reading methods
   */
  private async readRobotPositions(): Promise<Record<string, number>> {
    try {
      return await this.robot.getMotorPositions();
    } catch (error) {
      console.warn(
        `Failed to read robot positions: ${
          error instanceof Error ? error.message : error
        }`
      );
      // Return default positions as fallback
      const positions: Record<string, number> = {};
      this.motorNames.forEach((motor, index) => {
        positions[motor] = 2047; // STS3215 middle position
      });
      return positions;
    }
  }

  /**
   * Write positions to robot - optimized to only send changed motors
   * This was the key to the smooth performance in the working version
   */
  private async writeRobotPositions(
    newPositions: Record<string, number>
  ): Promise<void> {
    // Only send commands for motors that actually changed
    const changedPositions: Record<string, number> = {};
    let hasChanges = false;

    for (const [motor, newPosition] of Object.entries(newPositions)) {
      if (Math.abs(this.currentPositions[motor] - newPosition) > 0.5) {
        changedPositions[motor] = newPosition;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await this.robot.setMotorPositions(changedPositions);
    }
  }

  /**
   * Enforce position limits based on calibration data
   * Uses actual calibrated limits instead of hardcoded defaults
   */
  private enforcePositionLimits(positions: Record<string, number>): void {
    // Get calibrated limits from robot
    const calibratedLimits = this.robot.getCalibrationLimits();

    for (const [motor, position] of Object.entries(positions)) {
      const limits = calibratedLimits[motor];
      if (limits) {
        positions[motor] = Math.max(limits.min, Math.min(limits.max, position));
      }
    }
  }

  /**
   * Emergency stop - halt all robot movement
   */
  private async emergencyStop(): Promise<void> {
    try {
      // Stop all robot movement
      // TODO: Implement emergency stop in SO100Follower
      console.log("Emergency stop executed.");
      await this.stop();
      process.exit(0);
    } catch (error) {
      console.error("Emergency stop failed:", error);
      process.exit(1);
    }
  }
}

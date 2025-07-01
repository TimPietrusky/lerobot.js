/**
 * User-facing motor release functionality
 * Simple API - pass in robotConnection, motors get released
 *
 * Handles robot configuration and port management internally
 */

import { WebSerialPortWrapper } from "./utils/serial-port-wrapper.js";
import { createSO100Config } from "./robots/so100_config.js";
import { releaseMotors as releaseMotorsLowLevel } from "./utils/motor-communication.js";
import type { RobotConnection } from "./types/robot-connection.js";

/**
 * Release robot motors (allows free movement by hand)
 * Perfect for calibration setup or manual positioning
 *
 * @param robotConnection - Connected robot with configured type
 * @param motorIds - Optional specific motor IDs to release (defaults to all motors for robot type)
 * @throws Error if robot type not configured or motorIds invalid
 */
export async function releaseMotors(
  robotConnection: RobotConnection,
  motorIds?: number[]
): Promise<void> {
  // Validate robot type is configured
  if (!robotConnection.robotType) {
    throw new Error(
      "Robot type is required to release motors. Please configure the robot first."
    );
  }

  // Validate robot connection
  if (!robotConnection.isConnected || !robotConnection.port) {
    throw new Error(
      "Robot is not connected. Please use findPort() to connect first."
    );
  }

  // Create port wrapper for communication
  const port = new WebSerialPortWrapper(robotConnection.port);
  await port.initialize();

  // Get robot-specific configuration
  let robotConfig;
  if (robotConnection.robotType.startsWith("so100")) {
    robotConfig = createSO100Config(robotConnection.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${robotConnection.robotType}`);
  }

  // Determine which motors to release
  const motorsToRelease = motorIds || robotConfig.motorIds;

  // Validate motorIds are valid for this robot type
  if (motorIds) {
    const invalidMotors = motorIds.filter(
      (id) => !robotConfig.motorIds.includes(id)
    );
    if (invalidMotors.length > 0) {
      throw new Error(
        `Invalid motor IDs [${invalidMotors.join(", ")}] for ${
          robotConnection.robotType
        }. Valid IDs: [${robotConfig.motorIds.join(", ")}]`
      );
    }
  }

  // Release the motors using low-level function
  await releaseMotorsLowLevel(port, motorsToRelease);
}

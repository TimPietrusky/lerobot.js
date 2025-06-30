/**
 * SO-100 Leader Teleoperator implementation for Node.js
 *
 * Minimal implementation - calibration logic moved to shared/common/calibration.ts
 * This class only handles connection management and basic device operations
 */

import { Teleoperator } from "./teleoperator.js";
import type { TeleoperatorConfig } from "./config.js";

export class SO100Leader extends Teleoperator {
  constructor(config: TeleoperatorConfig) {
    super(config);

    // Validate that this is an SO-100 leader config
    if (config.type !== "so100_leader") {
      throw new Error(
        `Invalid teleoperator type: ${config.type}. Expected: so100_leader`
      );
    }
  }

  /**
   * Calibrate the SO-100 leader teleoperator
   * NOTE: Calibration logic has been moved to shared/common/calibration.ts
   * This method is kept for backward compatibility but delegates to the main calibrate.ts
   */
  async calibrate(): Promise<void> {
    throw new Error(
      "Direct device calibration is deprecated. Use the main calibrate.ts orchestrator instead."
    );
  }
}

/**
 * Factory function to create SO-100 leader teleoperator
 * Mirrors Python's make_teleoperator_from_config pattern
 */
export function createSO100Leader(config: TeleoperatorConfig): SO100Leader {
  return new SO100Leader(config);
}

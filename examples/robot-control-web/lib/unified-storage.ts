// Unified storage system for robot data
// Consolidates robot config, calibration data, and metadata under one key per device

export interface UnifiedRobotData {
  device_info: {
    serialNumber: string;
    robotType: "so100_follower" | "so100_leader";
    robotId: string;
    usbMetadata?: any;
    lastUpdated: string;
  };
  calibration?: {
    // Motor calibration data (from lerobot_calibration_* keys)
    shoulder_pan?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };
    shoulder_lift?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };
    elbow_flex?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };
    wrist_flex?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };
    wrist_roll?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };
    gripper?: {
      id: number;
      drive_mode: number;
      homing_offset: number;
      range_min: number;
      range_max: number;
    };

    // Calibration metadata (from lerobot-calibration-* keys)
    metadata: {
      timestamp: string;
      readCount: number;
      platform: string;
      api: string;
      device_type: string;
      device_id: string;
      calibrated_at: string;
    };
  };
}

/**
 * Get unified storage key for a robot by serial number
 */
export function getUnifiedKey(serialNumber: string): string {
  return `lerobotjs-${serialNumber}`;
}

/**
 * Migrate data from old storage keys to unified format
 * Safely combines data from three sources:
 * 1. lerobot-robot-{serialNumber} - robot config
 * 2. lerobot-calibration-{serialNumber} - calibration metadata
 * 3. lerobot_calibration_{robotType}_{robotId} - actual calibration data
 */
export function migrateToUnifiedStorage(
  serialNumber: string
): UnifiedRobotData | null {
  try {
    const unifiedKey = getUnifiedKey(serialNumber);

    // Check if already migrated
    const existing = localStorage.getItem(unifiedKey);
    if (existing) {
      console.log(`✅ Data already unified for ${serialNumber}`);
      return JSON.parse(existing);
    }

    console.log(`🔄 Migrating data for serial number: ${serialNumber}`);

    // 1. Get robot configuration
    const robotConfigKey = `lerobot-robot-${serialNumber}`;
    const robotConfigRaw = localStorage.getItem(robotConfigKey);

    if (!robotConfigRaw) {
      return null;
    }

    const robotConfig = JSON.parse(robotConfigRaw);
    console.log(`📋 Found robot config:`, robotConfig);

    // 2. Get calibration metadata
    const calibrationMetaKey = `lerobot-calibration-${serialNumber}`;
    const calibrationMetaRaw = localStorage.getItem(calibrationMetaKey);
    const calibrationMeta = calibrationMetaRaw
      ? JSON.parse(calibrationMetaRaw)
      : null;
    console.log(`📊 Found calibration metadata:`, calibrationMeta);

    // 3. Get actual calibration data (using robotType and robotId from config)
    const calibrationDataKey = `lerobot_calibration_${robotConfig.robotType}_${robotConfig.robotId}`;
    const calibrationDataRaw = localStorage.getItem(calibrationDataKey);
    const calibrationData = calibrationDataRaw
      ? JSON.parse(calibrationDataRaw)
      : null;
    console.log(`🔧 Found calibration data:`, calibrationData);

    // 4. Build unified structure
    const unifiedData: UnifiedRobotData = {
      device_info: {
        serialNumber: robotConfig.serialNumber || serialNumber,
        robotType: robotConfig.robotType,
        robotId: robotConfig.robotId,
        lastUpdated: robotConfig.lastUpdated || new Date().toISOString(),
      },
    };

    // Add calibration if available
    if (calibrationData && calibrationMeta) {
      const motors: any = {};

      // Copy motor data (excluding metadata fields)
      Object.keys(calibrationData).forEach((key) => {
        if (
          ![
            "device_type",
            "device_id",
            "calibrated_at",
            "platform",
            "api",
          ].includes(key)
        ) {
          motors[key] = calibrationData[key];
        }
      });

      unifiedData.calibration = {
        ...motors,
        metadata: {
          timestamp: calibrationMeta.timestamp || calibrationData.calibrated_at,
          readCount: calibrationMeta.readCount || 0,
          platform: calibrationData.platform || "web",
          api: calibrationData.api || "Web Serial API",
          device_type: calibrationData.device_type || robotConfig.robotType,
          device_id: calibrationData.device_id || robotConfig.robotId,
          calibrated_at:
            calibrationData.calibrated_at || calibrationMeta.timestamp,
        },
      };
    }

    // 5. Save unified data
    localStorage.setItem(unifiedKey, JSON.stringify(unifiedData));
    console.log(`✅ Successfully unified data for ${serialNumber}`);
    console.log(`📦 Unified data:`, unifiedData);

    // 6. Clean up old keys (optional - keep for now for safety)
    // localStorage.removeItem(robotConfigKey);
    // localStorage.removeItem(calibrationMetaKey);
    // localStorage.removeItem(calibrationDataKey);

    return unifiedData;
  } catch (error) {
    console.error(`❌ Failed to migrate data for ${serialNumber}:`, error);
    return null;
  }
}

/**
 * Get unified robot data
 */
export function getUnifiedRobotData(
  serialNumber: string
): UnifiedRobotData | null {
  const unifiedKey = getUnifiedKey(serialNumber);

  // Try to get existing unified data
  const existing = localStorage.getItem(unifiedKey);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch (error) {
      console.warn(`Failed to parse unified data for ${serialNumber}:`, error);
    }
  }

  return null;
}

/**
 * Save robot configuration to unified storage
 */
export function saveRobotConfig(
  serialNumber: string,
  robotType: "so100_follower" | "so100_leader",
  robotId: string,
  usbMetadata?: any
): void {
  const unifiedKey = getUnifiedKey(serialNumber);
  const existing =
    getUnifiedRobotData(serialNumber) || ({} as UnifiedRobotData);

  existing.device_info = {
    serialNumber,
    robotType,
    robotId,
    usbMetadata,
    lastUpdated: new Date().toISOString(),
  };

  localStorage.setItem(unifiedKey, JSON.stringify(existing));
  console.log(`💾 Saved robot config for ${serialNumber}`);
}

/**
 * Save calibration data to unified storage
 */
export function saveCalibrationData(
  serialNumber: string,
  calibrationData: any,
  metadata: { timestamp: string; readCount: number }
): void {
  const unifiedKey = getUnifiedKey(serialNumber);
  const existing =
    getUnifiedRobotData(serialNumber) || ({} as UnifiedRobotData);

  // Ensure device_info exists
  if (!existing.device_info) {
    console.warn(
      `No device info found for ${serialNumber}, cannot save calibration`
    );
    return;
  }

  // Extract motor data (exclude metadata fields)
  const motors: any = {};
  Object.keys(calibrationData).forEach((key) => {
    if (
      ![
        "device_type",
        "device_id",
        "calibrated_at",
        "platform",
        "api",
      ].includes(key)
    ) {
      motors[key] = calibrationData[key];
    }
  });

  existing.calibration = {
    ...motors,
    metadata: {
      timestamp: metadata.timestamp,
      readCount: metadata.readCount,
      platform: calibrationData.platform || "web",
      api: calibrationData.api || "Web Serial API",
      device_type:
        calibrationData.device_type || existing.device_info.robotType,
      device_id: calibrationData.device_id || existing.device_info.robotId,
      calibrated_at: calibrationData.calibrated_at || metadata.timestamp,
    },
  };

  localStorage.setItem(unifiedKey, JSON.stringify(existing));
  console.log(`🔧 Saved calibration data for ${serialNumber}`);
}

/**
 * Check if robot is calibrated
 */
export function isRobotCalibrated(serialNumber: string): boolean {
  const data = getUnifiedRobotData(serialNumber);
  return !!data?.calibration?.metadata?.timestamp;
}

/**
 * Get calibration status for dashboard
 */
export function getCalibrationStatus(
  serialNumber: string
): { timestamp: string; readCount: number } | null {
  const data = getUnifiedRobotData(serialNumber);
  if (data?.calibration?.metadata) {
    return {
      timestamp: data.calibration.metadata.timestamp,
      readCount: data.calibration.metadata.readCount,
    };
  }
  return null;
}

/**
 * Get robot configuration
 */
export function getRobotConfig(
  serialNumber: string
): { robotType: string; robotId: string } | null {
  const data = getUnifiedRobotData(serialNumber);
  if (data?.device_info) {
    return {
      robotType: data.device_info.robotType,
      robotId: data.device_info.robotId,
    };
  }
  return null;
}

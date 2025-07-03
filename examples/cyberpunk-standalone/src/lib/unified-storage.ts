/**
 * Unified storage for robot device data and calibration
 * Manages device persistence using localStorage with serial numbers as keys
 */

import type { WebCalibrationResults } from "@lerobot/web";

export interface DeviceInfo {
  serialNumber: string;
  robotType: string;
  robotId: string;
  usbMetadata?: {
    vendorId?: number;
    productId?: number;
    serialNumber?: string;
    manufacturer?: string;
    product?: string;
  };
}

export interface CalibrationMetadata {
  timestamp: string;
  readCount: number;
}

export interface UnifiedRobotData {
  device_info: DeviceInfo;
  calibration?: WebCalibrationResults & {
    device_type?: string;
    device_id?: string;
    calibrated_at?: string;
    platform?: string;
    api?: string;
  };
  calibration_metadata?: CalibrationMetadata;
}

export function getUnifiedRobotData(
  serialNumber: string
): UnifiedRobotData | null {
  try {
    const key = `lerobotjs-${serialNumber}`;
    const data = localStorage.getItem(key);
    if (!data) return null;

    const parsed = JSON.parse(data);
    return parsed as UnifiedRobotData;
  } catch (error) {
    console.warn(`Failed to load robot data for ${serialNumber}:`, error);
    return null;
  }
}

export function saveUnifiedRobotData(
  serialNumber: string,
  data: UnifiedRobotData
): void {
  try {
    const key = `lerobotjs-${serialNumber}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn(`Failed to save robot data for ${serialNumber}:`, error);
  }
}

export function saveCalibrationData(
  serialNumber: string,
  calibrationData: WebCalibrationResults,
  metadata: CalibrationMetadata
): void {
  try {
    const existingData = getUnifiedRobotData(serialNumber);
    if (!existingData) {
      console.warn(
        `No device info found for ${serialNumber}, cannot save calibration`
      );
      return;
    }

    const updatedData: UnifiedRobotData = {
      ...existingData,
      calibration: calibrationData,
      calibration_metadata: metadata,
    };

    saveUnifiedRobotData(serialNumber, updatedData);
  } catch (error) {
    console.warn(`Failed to save calibration data for ${serialNumber}:`, error);
  }
}

export function saveDeviceInfo(
  serialNumber: string,
  deviceInfo: DeviceInfo
): void {
  try {
    const existingData = getUnifiedRobotData(serialNumber);
    const updatedData: UnifiedRobotData = {
      ...existingData,
      device_info: deviceInfo,
    };

    saveUnifiedRobotData(serialNumber, updatedData);
  } catch (error) {
    console.warn(`Failed to save device info for ${serialNumber}:`, error);
  }
}

export function getAllSavedRobots(): DeviceInfo[] {
  try {
    const robots: DeviceInfo[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("lerobotjs-")) {
        const data = getUnifiedRobotData(key.replace("lerobotjs-", ""));
        if (data?.device_info) {
          robots.push(data.device_info);
        }
      }
    }

    return robots;
  } catch (error) {
    console.warn("Failed to load saved robots:", error);
    return [];
  }
}

export function removeRobotData(serialNumber: string): void {
  try {
    const key = `lerobotjs-${serialNumber}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Failed to remove robot data for ${serialNumber}:`, error);
  }
}

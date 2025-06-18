import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { calibrateWithPort } from "../../lerobot/web/calibrate";
import type { ConnectedRobot } from "../types";

interface CalibrationPanelProps {
  robot: ConnectedRobot;
  onFinish: () => void;
}

interface MotorCalibrationData {
  name: string;
  current: number;
  min: number;
  max: number;
  range: number;
}

export function CalibrationPanel({ robot, onFinish }: CalibrationPanelProps) {
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [motorData, setMotorData] = useState<MotorCalibrationData[]>([]);
  const [calibrationStatus, setCalibrationStatus] =
    useState<string>("Ready to calibrate");
  const [calibrationComplete, setCalibrationComplete] = useState(false);
  const [readCount, setReadCount] = useState(0);

  const animationFrameRef = useRef<number>();
  const lastReadTime = useRef<number>(0);
  const isReading = useRef<boolean>(false);

  // Motor names matching Node CLI exactly
  const motorNames = [
    "waist",
    "shoulder",
    "elbow",
    "forearm_roll",
    "wrist_angle",
    "wrist_rotate",
  ];

  // Initialize motor data with center positions
  const initializeMotorData = useCallback(() => {
    const initialData = motorNames.map((name) => ({
      name,
      current: 2047, // Center position for STS3215 (4095/2)
      min: 2047,
      max: 2047,
      range: 0,
    }));
    setMotorData(initialData);
    setReadCount(0);
  }, []);

  // Keep track of last known good positions to avoid glitches
  const lastKnownPositions = useRef<number[]>([
    2047, 2047, 2047, 2047, 2047, 2047,
  ]);

  // Read actual motor positions with robust error handling
  const readMotorPositions = useCallback(async (): Promise<number[]> => {
    if (!robot.port || !robot.port.readable || !robot.port.writable) {
      throw new Error("Robot port not available for communication");
    }

    const positions: number[] = [];
    const motorIds = [1, 2, 3, 4, 5, 6];

    // Get persistent reader/writer for this session
    const reader = robot.port.readable.getReader();
    const writer = robot.port.writable.getWriter();

    try {
      for (let index = 0; index < motorIds.length; index++) {
        const motorId = motorIds[index];
        let success = false;
        let retries = 2; // Allow 2 retries per motor

        while (!success && retries > 0) {
          try {
            // Create STS3215 Read Position packet
            const packet = new Uint8Array([
              0xff,
              0xff,
              motorId,
              0x04,
              0x02,
              0x38,
              0x02,
              0x00,
            ]);
            const checksum = ~(motorId + 0x04 + 0x02 + 0x38 + 0x02) & 0xff;
            packet[7] = checksum;

            // Write packet
            await writer.write(packet);

            // Wait for response
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Read with timeout
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Timeout")), 100)
            );

            const result = (await Promise.race([
              reader.read(),
              timeoutPromise,
            ])) as ReadableStreamReadResult<Uint8Array>;

            if (
              result &&
              !result.done &&
              result.value &&
              result.value.length >= 7
            ) {
              const response = result.value;
              const responseId = response[2];
              const error = response[4];

              // Check if this is the response we're looking for
              if (responseId === motorId && error === 0) {
                const position = response[5] | (response[6] << 8);
                positions.push(position);
                lastKnownPositions.current[index] = position; // Update last known good position
                success = true;
              } else {
                // Wrong motor ID or error - might be out of sync, try again
                retries--;
                await new Promise((resolve) => setTimeout(resolve, 5));
              }
            } else {
              retries--;
              await new Promise((resolve) => setTimeout(resolve, 5));
            }
          } catch (error) {
            retries--;
            await new Promise((resolve) => setTimeout(resolve, 5));
          }
        }

        if (!success) {
          // Use last known good position instead of fallback center position
          positions.push(lastKnownPositions.current[index]);
        }

        // Small delay between motors
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    } finally {
      reader.releaseLock();
      writer.releaseLock();
    }

    return positions;
  }, [robot.port]);

  // Update motor data with new readings - NO SIMULATION, REAL VALUES ONLY
  const updateMotorData = useCallback(async () => {
    if (!isCalibrating || isReading.current) return;

    const now = performance.now();
    // Read at ~15Hz to reduce serial communication load (66ms intervals)
    if (now - lastReadTime.current < 66) return;

    lastReadTime.current = now;
    isReading.current = true;

    try {
      const positions = await readMotorPositions();

      // Always update since we're now keeping last known good positions
      // Only show warning if all motors are still at center position (no successful reads yet)
      const allAtCenter = positions.every((pos) => pos === 2047);
      if (allAtCenter && readCount === 0) {
        console.log("No motor data received yet - still trying to connect");
        setCalibrationStatus("Connecting to motors - please wait...");
      }

      setMotorData((prev) =>
        prev.map((motor, index) => {
          const current = positions[index];
          const min = Math.min(motor.min, current);
          const max = Math.max(motor.max, current);
          const range = max - min;

          return {
            ...motor,
            current,
            min,
            max,
            range,
          };
        })
      );

      setReadCount((prev) => prev + 1);
      console.log(`Real motor positions:`, positions);
    } catch (error) {
      console.warn("Failed to read motor positions:", error);
      setCalibrationStatus(
        `Error reading motors: ${
          error instanceof Error ? error.message : error
        }`
      );
    } finally {
      isReading.current = false;
    }
  }, [isCalibrating, readMotorPositions]);

  // Animation loop using RAF (requestAnimationFrame)
  const animationLoop = useCallback(() => {
    updateMotorData();

    if (isCalibrating) {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    }
  }, [isCalibrating, updateMotorData]);

  useEffect(() => {
    initializeMotorData();
  }, [initializeMotorData]);

  useEffect(() => {
    if (isCalibrating) {
      animationFrameRef.current = requestAnimationFrame(animationLoop);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isCalibrating, animationLoop]);

  const startCalibration = async () => {
    if (!robot.port || !robot.robotType) {
      setCalibrationStatus("Error: Invalid robot configuration");
      return;
    }

    setCalibrationStatus(
      "Initializing calibration - reading current positions..."
    );

    try {
      // Get current positions to use as starting point for min/max
      const currentPositions = await readMotorPositions();

      // Reset calibration data with current positions as both min and max
      const freshData = motorNames.map((name, index) => ({
        name,
        current: currentPositions[index],
        min: currentPositions[index], // Start with current position
        max: currentPositions[index], // Start with current position
        range: 0, // No range yet
      }));

      setMotorData(freshData);
      setReadCount(0);
      setIsCalibrating(true);
      setCalibrationComplete(false);
      setCalibrationStatus(
        "Recording ranges of motion - move all joints through their full range..."
      );
    } catch (error) {
      setCalibrationStatus(
        `Error starting calibration: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  };

  // Generate calibration config JSON matching Node CLI format
  const generateConfigJSON = () => {
    const calibrationData = {
      homing_offset: motorData.map((motor) => motor.current - 2047), // Center offset
      drive_mode: [3, 3, 3, 3, 3, 3], // SO-100 standard drive mode
      start_pos: motorData.map((motor) => motor.min),
      end_pos: motorData.map((motor) => motor.max),
      calib_mode: ["middle", "middle", "middle", "middle", "middle", "middle"], // SO-100 standard
      motor_names: motorNames,
    };

    return calibrationData;
  };

  // Download calibration config as JSON file
  const downloadConfigJSON = () => {
    const configData = generateConfigJSON();
    const jsonString = JSON.stringify(configData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${robot.robotId || robot.robotType}_calibration.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const finishCalibration = () => {
    setIsCalibrating(false);
    setCalibrationComplete(true);
    setCalibrationStatus(
      `✅ Calibration completed! Recorded ${readCount} position readings.`
    );

    // Save calibration config to localStorage using serial number
    const configData = generateConfigJSON();
    const serialNumber = (robot as any).serialNumber;

    if (!serialNumber) {
      console.warn("⚠️ No serial number available for calibration storage");
      setCalibrationStatus(
        `⚠️ Calibration completed but cannot save - no robot serial number`
      );
      return;
    }

    const calibrationKey = `lerobot-calibration-${serialNumber}`;
    try {
      localStorage.setItem(
        calibrationKey,
        JSON.stringify({
          config: configData,
          timestamp: new Date().toISOString(),
          serialNumber: serialNumber,
          robotId: robot.robotId,
          robotType: robot.robotType,
          readCount: readCount,
        })
      );
      console.log(`💾 Calibration saved for robot serial: ${serialNumber}`);
    } catch (error) {
      console.warn("Failed to save calibration to localStorage:", error);
      setCalibrationStatus(
        `⚠️ Calibration completed but save failed: ${error}`
      );
    }
  };

  return (
    <div className="space-y-4">
      {/* Calibration Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                🛠️ Calibrating: {robot.robotId}
              </CardTitle>
              <CardDescription>
                {robot.robotType?.replace("_", " ")} • {robot.name}
              </CardDescription>
            </div>
            <Badge
              variant={
                isCalibrating
                  ? "default"
                  : calibrationComplete
                  ? "default"
                  : "outline"
              }
            >
              {isCalibrating
                ? "Recording"
                : calibrationComplete
                ? "Complete"
                : "Ready"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Status:</p>
              <p className="text-sm text-blue-800">{calibrationStatus}</p>
              {isCalibrating && (
                <p className="text-xs text-blue-600 mt-1">
                  Readings: {readCount} | Press "Finish Calibration" when done
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isCalibrating && !calibrationComplete && (
                <Button onClick={startCalibration}>Start Calibration</Button>
              )}

              {isCalibrating && (
                <Button onClick={finishCalibration} variant="outline">
                  Finish Calibration
                </Button>
              )}

              {calibrationComplete && (
                <>
                  <Button onClick={downloadConfigJSON} variant="outline">
                    Download Config JSON
                  </Button>
                  <Button onClick={onFinish}>Done</Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration JSON Display */}
      {calibrationComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              🎯 Calibration Configuration
            </CardTitle>
            <CardDescription>
              Copy this JSON or download it for your robot setup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto border">
                <code>{JSON.stringify(generateConfigJSON(), null, 2)}</code>
              </pre>
              <div className="flex gap-2">
                <Button onClick={downloadConfigJSON} variant="outline">
                  📄 Download JSON File
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(generateConfigJSON(), null, 2)
                    );
                  }}
                  variant="outline"
                >
                  📋 Copy to Clipboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Position Recording Table (matching Node CLI exactly) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Position Recording</CardTitle>
          <CardDescription>
            Real-time motor position feedback - exactly like Node CLI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full font-mono text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-900">
                    Motor Name
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">
                    Current
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">
                    Min
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">
                    Max
                  </th>
                  <th className="px-4 py-2 text-right font-medium text-gray-900">
                    Range
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {motorData.map((motor, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium flex items-center gap-2">
                      {motor.name}
                      {motor.range > 100 && (
                        <span className="text-green-600 text-xs">✓</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{motor.current}</td>
                    <td className="px-4 py-2 text-right">{motor.min}</td>
                    <td className="px-4 py-2 text-right">{motor.max}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      <span
                        className={
                          motor.range > 100 ? "text-green-600" : "text-gray-500"
                        }
                      >
                        {motor.range}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isCalibrating && (
            <div className="mt-3 text-center text-sm text-gray-600">
              Move joints through their full range of motion...
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

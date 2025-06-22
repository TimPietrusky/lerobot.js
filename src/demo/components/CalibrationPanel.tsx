import React, { useState, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import {
  calibrate,
  type WebCalibrationResults,
  type LiveCalibrationData,
  type CalibrationProcess,
} from "../../lerobot/web/calibrate";
import { releaseMotors } from "../../lerobot/web/utils/motor-communication.js";
import { WebSerialPortWrapper } from "../../lerobot/web/utils/serial-port-wrapper.js";
import { createSO100Config } from "../../lerobot/web/robots/so100_config.js";
import { CalibrationModal } from "./CalibrationModal";
import type { RobotConnection } from "../../lerobot/web/find_port.js";

interface CalibrationPanelProps {
  robot: RobotConnection;
  onFinish: () => void;
}

export function CalibrationPanel({ robot, onFinish }: CalibrationPanelProps) {
  // Simple state management
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationResult, setCalibrationResult] =
    useState<WebCalibrationResults | null>(null);
  const [status, setStatus] = useState<string>("Ready to calibrate");
  const [modalOpen, setModalOpen] = useState(false);
  const [calibrationProcess, setCalibrationProcess] =
    useState<CalibrationProcess | null>(null);
  const [motorData, setMotorData] = useState<LiveCalibrationData>({});
  const [isPreparing, setIsPreparing] = useState(false);

  // Motor names for display
  const motorNames = useMemo(
    () => [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ],
    []
  );

  // Initialize motor data
  const initializeMotorData = useCallback(() => {
    const initialData: LiveCalibrationData = {};
    motorNames.forEach((name) => {
      initialData[name] = {
        current: 2047,
        min: 2047,
        max: 2047,
        range: 0,
      };
    });
    setMotorData(initialData);
  }, [motorNames]);

  // Release motor torque for better UX - allows immediate joint movement
  const releaseMotorTorque = useCallback(async () => {
    if (!robot.port || !robot.robotType) {
      return;
    }

    try {
      setIsPreparing(true);
      setStatus("🔓 Releasing motor torque - joints can now be moved freely");

      // Create port wrapper and config to get motor IDs
      const port = new WebSerialPortWrapper(robot.port);
      await port.initialize();
      const config = createSO100Config(robot.robotType);

      // Release motors so they can be moved freely by hand
      await releaseMotors(port, config.motorIds);

      setStatus("✅ Joints are now free to move - set your homing position");
    } catch (error) {
      console.warn("Failed to release motor torque:", error);
      setStatus("⚠️ Could not release motor torque - try moving joints gently");
    } finally {
      setIsPreparing(false);
    }
  }, [robot]);

  // Start calibration using new API
  const handleContinueCalibration = useCallback(async () => {
    setModalOpen(false);

    if (!robot.port || !robot.robotType) {
      return;
    }

    try {
      setStatus("🤖 Starting calibration process...");
      setIsCalibrating(true);
      initializeMotorData();

      // Use the new unified calibrate API - pass the whole robot connection
      const robotConnection = {
        port: robot.port,
        robotType: robot.robotType!,
        robotId: robot.robotId || `${robot.robotType}_1`,
        serialNumber: robot.serialNumber || `unknown_${Date.now()}`,
        connected: robot.isConnected,
      } as any; // Type assertion to work around SerialPort type differences

      const process = await calibrate(robotConnection, {
        onLiveUpdate: (data) => {
          setMotorData(data);
          setStatus(
            "📏 Recording joint ranges - move all joints through their full range"
          );
        },
        onProgress: (message) => {
          setStatus(message);
        },
      });

      setCalibrationProcess(process);

      // Add Enter key listener for stopping (matching Node.js UX)
      const handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          process.stop();
        }
      };
      document.addEventListener("keydown", handleKeyPress);

      try {
        // Wait for calibration to complete
        const result = await process.result;
        setCalibrationResult(result);

        // App-level concern: Save results to storage
        const serialNumber =
          robot.serialNumber || robot.usbMetadata?.serialNumber || "unknown";
        await saveCalibrationResults(
          result,
          robot.robotType,
          robot.robotId || `${robot.robotType}_1`,
          serialNumber
        );

        setStatus(
          "✅ Calibration completed successfully! Configuration saved."
        );
      } finally {
        document.removeEventListener("keydown", handleKeyPress);
        setCalibrationProcess(null);
        setIsCalibrating(false);
      }
    } catch (error) {
      console.error("❌ Calibration failed:", error);
      setStatus(
        `❌ Calibration failed: ${
          error instanceof Error ? error.message : error
        }`
      );
      setIsCalibrating(false);
      setCalibrationProcess(null);
    }
  }, [robot, initializeMotorData]);

  // Stop calibration recording
  const handleStopRecording = useCallback(() => {
    if (calibrationProcess) {
      calibrationProcess.stop();
    }
  }, [calibrationProcess]);

  // App-level concern: Save calibration results
  const saveCalibrationResults = async (
    results: WebCalibrationResults,
    robotType: string,
    robotId: string,
    serialNumber: string
  ) => {
    try {
      // Save to unified storage (app-level functionality)
      const { saveCalibrationData } = await import("../lib/unified-storage.js");

      const fullCalibrationData = {
        ...results,
        device_type: robotType,
        device_id: robotId,
        calibrated_at: new Date().toISOString(),
        platform: "web",
        api: "Web Serial API",
      };

      const metadata = {
        timestamp: new Date().toISOString(),
        readCount: Object.keys(motorData).length > 0 ? 100 : 0, // Estimate
      };

      saveCalibrationData(serialNumber, fullCalibrationData, metadata);
    } catch (error) {
      console.warn("Failed to save calibration results:", error);
    }
  };

  // App-level concern: JSON export functionality
  const downloadConfigJSON = useCallback(() => {
    if (!calibrationResult) return;

    const jsonString = JSON.stringify(calibrationResult, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${robot.robotId || robot.robotType}_calibration.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [calibrationResult, robot.robotId, robot.robotType]);

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
                  : calibrationResult
                  ? "default"
                  : "outline"
              }
            >
              {isCalibrating
                ? "Recording"
                : calibrationResult
                ? "Complete"
                : "Ready"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-900">Status:</p>
              <p className="text-sm text-blue-800">{status}</p>
              {isCalibrating && (
                <p className="text-xs text-blue-600 mt-1">
                  Move joints through full range | Press "Finish Recording" or
                  Enter key when done
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isCalibrating && !calibrationResult && (
                <Button
                  onClick={async () => {
                    // Release motor torque FIRST - so user can move joints immediately
                    await releaseMotorTorque();
                    // THEN open modal - user can now follow instructions right away
                    setModalOpen(true);
                  }}
                  disabled={isPreparing}
                >
                  {isPreparing ? "Preparing..." : "Start Calibration"}
                </Button>
              )}

              {isCalibrating && calibrationProcess && (
                <Button onClick={handleStopRecording} variant="default">
                  Finish Recording
                </Button>
              )}

              {calibrationResult && (
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
      {calibrationResult && (
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
                <code>{JSON.stringify(calibrationResult, null, 2)}</code>
              </pre>
              <div className="flex gap-2">
                <Button onClick={downloadConfigJSON} variant="outline">
                  📄 Download JSON File
                </Button>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      JSON.stringify(calibrationResult, null, 2)
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

      {/* Live Position Recording Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live Position Recording</CardTitle>
          <CardDescription>
            Real-time motor position feedback during calibration
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
                {motorNames.map((motorName) => {
                  const motor = motorData[motorName] || {
                    current: 2047,
                    min: 2047,
                    max: 2047,
                    range: 0,
                  };

                  return (
                    <tr key={motorName} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium flex items-center gap-2">
                        {motorName}
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
                            motor.range > 100
                              ? "text-green-600"
                              : "text-gray-500"
                          }
                        >
                          {motor.range}
                        </span>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Calibration Modal */}
      <CalibrationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        deviceType={robot.robotType || "robot"}
        onContinue={handleContinueCalibration}
      />
    </div>
  );
}

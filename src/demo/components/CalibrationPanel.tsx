import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
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
  createCalibrationController,
  WebCalibrationController,
  saveCalibrationResults,
  type WebCalibrationResults,
} from "../../lerobot/web/calibrate";
import { CalibrationModal } from "./CalibrationModal";
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

/**
 * Custom hook for calibration that manages the serial port properly
 * Uses vanilla calibration functions internally, provides React-friendly interface
 */
function useCalibration(robot: ConnectedRobot) {
  const [controller, setController] = useState<WebCalibrationController | null>(
    null
  );
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isRecordingRanges, setIsRecordingRanges] = useState(false);
  const [calibrationResult, setCalibrationResult] =
    useState<WebCalibrationResults | null>(null);
  const [status, setStatus] = useState<string>("Ready to calibrate");

  // Motor data state
  const [motorData, setMotorData] = useState<MotorCalibrationData[]>([]);

  // Static motor names - use useMemo to prevent recreation on every render
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

  // Initialize controller when robot changes
  const initializeController = useCallback(async () => {
    if (!robot.port || !robot.robotType) {
      throw new Error("Invalid robot configuration");
    }

    const newController = await createCalibrationController(
      robot.robotType,
      robot.port
    );
    setController(newController);
    return newController;
  }, [robot.port, robot.robotType]);

  // Read motor positions using the controller (no concurrent access)
  const readMotorPositions = useCallback(async (): Promise<number[]> => {
    if (!controller) {
      throw new Error("Controller not initialized");
    }
    return await controller.readMotorPositions();
  }, [controller]);

  // Update motor data from positions
  const updateMotorData = useCallback(
    (
      positions: number[],
      rangeMins?: { [motor: string]: number },
      rangeMaxes?: { [motor: string]: number }
    ) => {
      const newData = motorNames.map((name, index) => {
        const current = positions[index];
        const min = rangeMins ? rangeMins[name] : current;
        const max = rangeMaxes ? rangeMaxes[name] : current;

        return {
          name,
          current,
          min,
          max,
          range: max - min,
        };
      });

      setMotorData(newData);
    },
    [motorNames]
  );

  // Initialize motor data
  const initializeMotorData = useCallback(() => {
    const initialData = motorNames.map((name) => ({
      name,
      current: 2047,
      min: 2047,
      max: 2047,
      range: 0,
    }));
    setMotorData(initialData);
  }, [motorNames]);

  // Start calibration process
  const startCalibration = useCallback(async () => {
    try {
      setStatus("🤖 Starting calibration process...");
      setIsCalibrating(true);

      const ctrl = await initializeController();

      // Step 1: Homing
      setStatus("📍 Setting homing position...");
      await ctrl.performHomingStep();

      return ctrl;
    } catch (error) {
      setIsCalibrating(false);
      throw error;
    }
  }, [initializeController]);

  // Start range recording
  const startRangeRecording = useCallback(
    async (
      controllerToUse: WebCalibrationController,
      stopFunction: () => boolean,
      onUpdate?: (
        mins: { [motor: string]: number },
        maxes: { [motor: string]: number },
        currentPositions: { [motor: string]: number }
      ) => void
    ) => {
      if (!controllerToUse) {
        throw new Error("Controller not provided");
      }

      setStatus(
        "📏 Recording joint ranges - move all joints through their full range"
      );
      setIsRecordingRanges(true);

      try {
        await controllerToUse.performRangeRecordingStep(
          stopFunction,
          (rangeMins, rangeMaxes, currentPositions) => {
            setStatus("📏 Recording joint ranges - capturing data...");

            // Update motor data with CURRENT LIVE POSITIONS (not averages!)
            const currentPositionsArray = motorNames.map(
              (name) => currentPositions[name]
            );
            updateMotorData(currentPositionsArray, rangeMins, rangeMaxes);

            if (onUpdate) {
              onUpdate(rangeMins, rangeMaxes, currentPositions);
            }
          }
        );
      } finally {
        setIsRecordingRanges(false);
      }
    },
    [motorNames, updateMotorData]
  );

  // Finish calibration
  const finishCalibration = useCallback(
    async (
      controllerToUse?: WebCalibrationController,
      recordingCount?: number
    ) => {
      const ctrl = controllerToUse || controller;
      if (!ctrl) {
        throw new Error("Controller not initialized");
      }

      setStatus("💾 Finishing calibration...");
      const result = await ctrl.finishCalibration();
      setCalibrationResult(result);

      // Save results using serial number for dashboard detection
      // Use the same serial number logic as dashboard: prefer main serialNumber, fallback to USB metadata, then "unknown"
      const serialNumber =
        robot.serialNumber || robot.usbMetadata?.serialNumber || "unknown";

      console.log("🔍 Debug - Saving calibration with:", {
        robotType: robot.robotType,
        robotId: robot.robotId,
        mainSerialNumber: robot.serialNumber,
        usbSerialNumber: robot.usbMetadata?.serialNumber,
        finalSerialNumber: serialNumber,
        storageKey: `lerobotjs-${serialNumber}`,
      });

      await saveCalibrationResults(
        result,
        robot.robotType!,
        robot.robotId || `${robot.robotType}_1`,
        serialNumber,
        recordingCount || 0
      );

      // Update final motor data
      const finalData = motorNames.map((motorName) => {
        const motorResult = result[motorName];
        return {
          name: motorName,
          current: (motorResult.range_min + motorResult.range_max) / 2,
          min: motorResult.range_min,
          max: motorResult.range_max,
          range: motorResult.range_max - motorResult.range_min,
        };
      });

      setMotorData(finalData);
      setStatus("✅ Calibration completed successfully! Configuration saved.");
      setIsCalibrating(false);

      return result;
    },
    [controller, robot.robotType, robot.robotId, motorNames]
  );

  // Reset states
  const reset = useCallback(() => {
    setController(null);
    setIsCalibrating(false);
    setIsRecordingRanges(false);
    setCalibrationResult(null);
    setStatus("Ready to calibrate");
    initializeMotorData();
  }, [initializeMotorData]);

  // Initialize on mount
  useEffect(() => {
    initializeMotorData();
  }, [initializeMotorData]);

  return {
    // State
    controller,
    isCalibrating,
    isRecordingRanges,
    calibrationResult,
    status,
    motorData,

    // Actions
    startCalibration,
    startRangeRecording,
    finishCalibration,
    readMotorPositions,
    reset,

    // Utilities
    updateMotorData,
  };
}

export function CalibrationPanel({ robot, onFinish }: CalibrationPanelProps) {
  const {
    controller,
    isCalibrating,
    isRecordingRanges,
    calibrationResult,
    status,
    motorData,
    startCalibration,
    startRangeRecording,
    finishCalibration,
    readMotorPositions,
    reset,
    updateMotorData,
  } = useCalibration(robot);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);

  // Recording state
  const [stopRecordingFunction, setStopRecordingFunction] = useState<
    (() => void) | null
  >(null);

  // Motor names matching Python lerobot exactly (NOT Node CLI)
  const motorNames = [
    "shoulder_pan",
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper",
  ];

  // Motor IDs for SO-100 (STS3215 servos)
  const motorIds = [1, 2, 3, 4, 5, 6];

  // Keep track of last known good positions to avoid glitches
  const lastKnownPositions = useRef<number[]>([
    2047, 2047, 2047, 2047, 2047, 2047,
  ]);

  // NO concurrent motor reading - let the calibration hook handle all serial operations

  const handleContinueCalibration = async () => {
    setModalOpen(false);

    if (!robot.port || !robot.robotType) {
      return;
    }

    try {
      const ctrl = await startCalibration();

      // Set up manual control - user decides when to stop
      let shouldStopRecording = false;
      let recordingCount = 0;

      // Create stop function and store it in state for the button
      const stopRecording = () => {
        shouldStopRecording = true;
      };
      setStopRecordingFunction(() => stopRecording);

      // Add Enter key listener
      const handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
          shouldStopRecording = true;
        }
      };

      document.addEventListener("keydown", handleKeyPress);

      try {
        await startRangeRecording(
          ctrl,
          () => {
            return shouldStopRecording;
          },
          (rangeMins, rangeMaxes, currentPositions) => {
            recordingCount++;
          }
        );
      } finally {
        document.removeEventListener("keydown", handleKeyPress);
        setStopRecordingFunction(null);
      }

      // Step 3: Finish calibration with recording count
      await finishCalibration(ctrl, recordingCount);
    } catch (error) {
      console.error("❌ Calibration failed:", error);
    }
  };

  // Generate calibration config JSON matching Python lerobot format (OBJECT format, not arrays)
  const generateConfigJSON = () => {
    // Use the calibration result if available
    if (calibrationResult) {
      return calibrationResult;
    }

    // Fallback: generate from motor data (shouldn't happen with new flow)
    const calibrationData: any = {};
    motorNames.forEach((motorName, index) => {
      const motor = motorData[index];
      calibrationData[motorName] = {
        homing_offset: motor.current - 2047, // Center offset for STS3215 (4095/2)
        drive_mode: 0, // Python lerobot SO-100 uses drive_mode 0
        start_pos: motor.min,
        end_pos: motor.max,
        calib_mode: "middle", // Python lerobot SO-100 standard
      };
    });

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
                  Move joints through full range | Press "Finish Recording" when
                  done
                </p>
              )}
            </div>

            <div className="flex gap-2">
              {!isCalibrating && !calibrationResult && (
                <Button onClick={() => setModalOpen(true)}>
                  Start Calibration
                </Button>
              )}

              {isCalibrating && !isRecordingRanges && (
                <Button onClick={finishCalibration} variant="outline">
                  Finish Calibration
                </Button>
              )}

              {isRecordingRanges && stopRecordingFunction && (
                <Button onClick={stopRecordingFunction} variant="default">
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

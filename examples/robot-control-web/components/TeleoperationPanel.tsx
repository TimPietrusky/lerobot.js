import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import {
  teleoperate,
  type TeleoperationProcess,
  type TeleoperationState,
  type TeleoperateConfig,
  LeRobotDatasetRecorder,
} from "@lerobot/web";
import { getUnifiedRobotData } from "../lib/unified-storage";
import type { RobotConnection } from "@lerobot/web";
import { SO100_KEYBOARD_CONTROLS } from "@lerobot/web";
import { LeRobotDatasetRecorderPanel } from "./LeRobotDatasetRecorderPanel";

interface TeleoperationPanelProps {
  robot: RobotConnection;
  onClose: () => void;
}

export function TeleoperationPanel({
  robot,
  onClose,
}: TeleoperationPanelProps) {
  const [teleoperationState, setTeleoperationState] =
    useState<TeleoperationState>({
      isActive: false,
      motorConfigs: [],
      lastUpdate: 0,
      keyStates: {},
    });
  const [error, setError] = useState<string | null>(null);
  const [, setIsInitialized] = useState(false);

  // Separate refs for keyboard and direct teleoperators
  const keyboardProcessRef = useRef<TeleoperationProcess | null>(null);
  const directProcessRef = useRef<TeleoperationProcess | null>(null);
  const leRobotDatasetRecorderRef = useRef<LeRobotDatasetRecorder | null>(null);

  // Initialize both teleoperation processes
  useEffect(() => {
    const initializeTeleoperation = async () => {
      if (!robot || !robot.robotType) {
        setError("No robot configuration available");
        return;
      }

      try {
        // Load calibration data from demo storage (app concern)
        let calibrationData;
        if (robot.serialNumber) {
          const data = getUnifiedRobotData(robot.serialNumber);
          calibrationData = data?.calibration;
          if (calibrationData) {
            console.log("✅ Loaded calibration data for", robot.serialNumber);
          }
        }

        // Create keyboard teleoperation process
        const keyboardConfig: TeleoperateConfig = {
          robot: robot,
          teleop: {
            type: "keyboard",
          },
          calibrationData,
          onStateUpdate: (state: TeleoperationState) => {
            setTeleoperationState(state);
          },
        };
        const keyboardProcess = await teleoperate(keyboardConfig);

        // Create direct teleoperation process
        const directConfig: TeleoperateConfig = {
          robot: robot,
          teleop: {
            type: "direct",
          },
          calibrationData,
        };
        const directProcess = await teleoperate(directConfig);

        keyboardProcessRef.current = keyboardProcess;
        directProcessRef.current = directProcess;
        setTeleoperationState(keyboardProcess.getState());
        setIsInitialized(true);
        setError(null);

        console.log("✅ Initialized both keyboard and direct teleoperators");

        leRobotDatasetRecorderRef.current = 
            new LeRobotDatasetRecorder([keyboardProcess.teleoperator,directProcess.teleoperator], {}, 30);
        
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Failed to initialize teleoperation";
        setError(errorMessage);
        console.error("❌ Failed to initialize teleoperation:", error);
      }
    };

    initializeTeleoperation();

    return () => {
      // Cleanup on unmount
      const cleanup = async () => {
        try {
          if (keyboardProcessRef.current) {
            await keyboardProcessRef.current.disconnect();
            keyboardProcessRef.current = null;
          }
          if (directProcessRef.current) {
            await directProcessRef.current.disconnect();
            directProcessRef.current = null;
          }
          console.log("🧹 Teleoperation cleanup completed");
        } catch (error) {
          console.warn("Error during teleoperation cleanup:", error);
        }
      };
      cleanup();
    };
  }, [robot]);

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!teleoperationState.isActive || !keyboardProcessRef.current) return;

      const key = event.key;
      event.preventDefault();
      keyboardProcessRef.current.updateKeyState(key, true);
    },
    [teleoperationState.isActive]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!teleoperationState.isActive || !keyboardProcessRef.current) return;

      const key = event.key;
      event.preventDefault();
      keyboardProcessRef.current.updateKeyState(key, false);
    },
    [teleoperationState.isActive]
  );

  // Register keyboard events
  useEffect(() => {
    if (teleoperationState.isActive) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [teleoperationState.isActive, handleKeyDown, handleKeyUp]);

  const handleStart = () => {
    if (!keyboardProcessRef.current || !directProcessRef.current) {
      setError("Teleoperation not initialized");
      return;
    }

    try {
      keyboardProcessRef.current.start();
      directProcessRef.current.start();
      console.log("🎮 Both keyboard and direct teleoperation started");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to start teleoperation";
      setError(errorMessage);
    }
  };

  const handleStop = async () => {
    try {
      if (keyboardProcessRef.current) {
        keyboardProcessRef.current.stop();
      }
      if (directProcessRef.current) {
        directProcessRef.current.stop();
      }
      console.log("🛑 Both keyboard and direct teleoperation stopped");
    } catch (error) {
      console.warn("Error during teleoperation stop:", error);
    }
  };

  const handleClose = async () => {
    try {
      if (keyboardProcessRef.current) {
        keyboardProcessRef.current.stop();
        await keyboardProcessRef.current.disconnect();
      }
      if (directProcessRef.current) {
        directProcessRef.current.stop();
        await directProcessRef.current.disconnect();
      }
      console.log("🔌 Properly disconnected from robot");
    } catch (error) {
      console.warn("Error during teleoperation cleanup:", error);
    }
    onClose();
  };

  const simulateKeyPress = (key: string) => {
    if (!keyboardProcessRef.current) return;
    keyboardProcessRef.current.updateKeyState(key, true);
  };

  const simulateKeyRelease = (key: string) => {
    if (!keyboardProcessRef.current) return;
    keyboardProcessRef.current.updateKeyState(key, false);
  };

  // Unified motor control: Both sliders AND keyboard use the same teleoperator
  // This ensures the UI always shows the correct motor positions
  const moveMotorToPosition = async (motorIndex: number, position: number) => {
    if (!keyboardProcessRef.current) return;

    try {
      const motorName = teleoperationState.motorConfigs[motorIndex]?.name;
      if (motorName) {
        const keyboardTeleoperator = keyboardProcessRef.current
          .teleoperator as any;
        await keyboardTeleoperator.moveMotor(motorName, position);
      }
    } catch (error) {
      console.warn(
        `Failed to move motor ${motorIndex + 1} to position ${position}:`,
        error
      );
    }
  };

  const isConnected = robot?.isConnected || false;
  const isActive = teleoperationState.isActive;
  const motorConfigs = teleoperationState.motorConfigs;
  const keyStates = teleoperationState.keyStates;

  // Virtual keyboard component
  const VirtualKeyboard = () => {
    const isKeyPressed = (key: string) => {
      return keyStates?.[key]?.pressed || false;
    };

    const KeyButton = ({
      keyCode,
      children,
      className = "",
      size = "default" as "default" | "sm" | "lg" | "icon",
    }: {
      keyCode: string;
      children: React.ReactNode;
      className?: string;
      size?: "default" | "sm" | "lg" | "icon";
    }) => {
      const control =
        SO100_KEYBOARD_CONTROLS[
          keyCode as keyof typeof SO100_KEYBOARD_CONTROLS
        ];
      const pressed = isKeyPressed(keyCode);

      const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isActive) return;
        simulateKeyPress(keyCode);
      };

      const handleMouseUp = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!isActive) return;
        simulateKeyRelease(keyCode);
      };

      return (
        <Button
          variant={pressed ? "default" : "outline"}
          size={size}
          className={`
            ${className}
            ${
              pressed
                ? "bg-blue-600 text-white shadow-inner"
                : "hover:bg-gray-100"
            }
            transition-all duration-75 font-mono text-xs
            ${!isActive ? "opacity-50 cursor-not-allowed" : ""}
          `}
          disabled={!isActive}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          title={control?.description || keyCode}
        >
          {children}
        </Button>
      );
    };

    return (
      <div className="space-y-4">
        {/* Arrow Keys */}
        <div className="text-center">
          <h4 className="text-xs font-semibold mb-2 text-gray-600">Shoulder</h4>
          <div className="flex flex-col items-center gap-1">
            <KeyButton keyCode="ArrowUp" size="sm">
              ↑
            </KeyButton>
            <div className="flex gap-1">
              <KeyButton keyCode="ArrowLeft" size="sm">
                ←
              </KeyButton>
              <KeyButton keyCode="ArrowDown" size="sm">
                ↓
              </KeyButton>
              <KeyButton keyCode="ArrowRight" size="sm">
                →
              </KeyButton>
            </div>
          </div>
        </div>

        {/* WASD Keys */}
        <div className="text-center">
          <h4 className="text-xs font-semibold mb-2 text-gray-600">
            Elbow/Wrist
          </h4>
          <div className="flex flex-col items-center gap-1">
            <KeyButton keyCode="w" size="sm">
              W
            </KeyButton>
            <div className="flex gap-1">
              <KeyButton keyCode="a" size="sm">
                A
              </KeyButton>
              <KeyButton keyCode="s" size="sm">
                S
              </KeyButton>
              <KeyButton keyCode="d" size="sm">
                D
              </KeyButton>
            </div>
          </div>
        </div>

        {/* Q/E and Gripper */}
        <div className="flex justify-center gap-2">
          <div className="text-center">
            <h4 className="text-xs font-semibold mb-2 text-gray-600">Roll</h4>
            <div className="flex gap-1">
              <KeyButton keyCode="q" size="sm">
                Q
              </KeyButton>
              <KeyButton keyCode="e" size="sm">
                E
              </KeyButton>
            </div>
          </div>
          <div className="text-center">
            <h4 className="text-xs font-semibold mb-2 text-gray-600">
              Gripper
            </h4>
            <div className="flex gap-1">
              <KeyButton keyCode="o" size="sm">
                O
              </KeyButton>
              <KeyButton keyCode="c" size="sm">
                C
              </KeyButton>
            </div>
          </div>
        </div>

        {/* Emergency Stop */}
        <div className="text-center border-t pt-2">
          <KeyButton
            keyCode="Escape"
            className="bg-red-100 border-red-300 hover:bg-red-200 text-red-800 text-xs"
          >
            ESC
          </KeyButton>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              🎮 Robot Teleoperation
            </h1>
            <p className="text-gray-600">
              {robot.robotId || robot.name} - {robot.serialNumber}
            </p>
          </div>
          <Button variant="outline" onClick={handleClose}>
            ← Back to Dashboard
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Status
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Teleoperation</span>
                <Badge variant={isActive ? "default" : "secondary"}>
                  {isActive ? "Active" : "Stopped"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Keys</span>
                <Badge variant="outline">
                  {
                    Object.values(keyStates || {}).filter(
                      (state) => state.pressed
                    ).length
                  }
                </Badge>
              </div>

              <div className="space-y-2">
                {isActive ? (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    className="w-full"
                  >
                    ⏹️ Stop Teleoperation
                  </Button>
                ) : (
                  <Button
                    onClick={handleStart}
                    disabled={!isConnected}
                    className="w-full"
                  >
                    ▶️ Start Teleoperation
                  </Button>
                )}
              </div>
            </CardContent>

            {leRobotDatasetRecorderRef.current && (
              <LeRobotDatasetRecorderPanel recorder={leRobotDatasetRecorderRef.current} />
            )}
          </Card>

          {/* Virtual Keyboard */}
          <Card>
            <CardHeader>
              <CardTitle>Virtual Keyboard</CardTitle>
            </CardHeader>
            <CardContent>
              <VirtualKeyboard />
            </CardContent>
          </Card>

          {/* Motor Status */}
          <Card>
            <CardHeader>
              <CardTitle>Motor Positions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {motorConfigs.map((motor, index) => {
                return (
                  <div key={motor.name} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {motor.name.replace("_", " ")}
                      </span>
                      <span className="text-xs text-gray-500">
                        {motor.currentPosition}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={motor.minPosition}
                      max={motor.maxPosition}
                      value={motor.currentPosition}
                      disabled={!isActive}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 slider-thumb ${
                        !isActive ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      style={{
                        background: isActive
                          ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                              ((motor.currentPosition - motor.minPosition) /
                                (motor.maxPosition - motor.minPosition)) *
                              100
                            }%, #e5e7eb ${
                              ((motor.currentPosition - motor.minPosition) /
                                (motor.maxPosition - motor.minPosition)) *
                              100
                            }%, #e5e7eb 100%)`
                          : "#e5e7eb",
                      }}
                      onChange={async (e) => {
                        if (!isActive) return;
                        const newPosition = parseInt(e.target.value);
                        try {
                          await moveMotorToPosition(index, newPosition);
                        } catch (error) {
                          console.warn(
                            "Failed to move motor via slider:",
                            error
                          );
                        }
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{motor.minPosition}</span>
                      <span>{motor.maxPosition}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Help Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Control Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Arrow Keys</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>↑ ↓ Shoulder lift</li>
                  <li>← → Shoulder pan</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">WASD Keys</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>W S Elbow flex</li>
                  <li>A D Wrist flex</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Other Keys</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>Q E Wrist roll</li>
                  <li>O Open gripper</li>
                  <li>C Close gripper</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-red-700">Emergency</h4>
                <ul className="space-y-1 text-red-600">
                  <li>ESC Emergency stop</li>
                </ul>
              </div>
            </div>
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                💡 <strong>Pro tip:</strong> Use your physical keyboard for
                faster control, or click the virtual keys below. Hold keys down
                for continuous movement.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

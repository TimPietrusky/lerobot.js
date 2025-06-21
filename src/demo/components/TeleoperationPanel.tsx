import React, { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Alert, AlertDescription } from "./ui/alert";
import { Progress } from "./ui/progress";
import { useTeleoperation } from "../hooks/useTeleoperation";
import type { ConnectedRobot } from "../types";
import { KEYBOARD_CONTROLS } from "../../lerobot/web/teleoperate";

interface TeleoperationPanelProps {
  robot: ConnectedRobot;
  onClose: () => void;
}

export function TeleoperationPanel({
  robot,
  onClose,
}: TeleoperationPanelProps) {
  const [enabled, setEnabled] = useState(false);

  const {
    isConnected,
    isActive,
    motorConfigs,
    keyStates,
    error,
    start,
    stop,
    goToHome,
    simulateKeyPress,
    simulateKeyRelease,
  } = useTeleoperation({
    robot,
    enabled,
    onError: (err: string) => console.error("Teleoperation error:", err),
  });

  const handleStart = async () => {
    setEnabled(true);
    await start();
  };

  const handleStop = () => {
    stop();
    setEnabled(false);
  };

  const handleClose = () => {
    stop();
    setEnabled(false);
    onClose();
  };

  // Virtual keyboard component
  const VirtualKeyboard = () => {
    const isKeyPressed = (key: string) => {
      return keyStates[key]?.pressed || false;
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
        KEYBOARD_CONTROLS[keyCode as keyof typeof KEYBOARD_CONTROLS];
      const pressed = isKeyPressed(keyCode);

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
          onMouseDown={(e) => {
            e.preventDefault();
            if (isActive) simulateKeyPress(keyCode);
          }}
          onMouseUp={(e) => {
            e.preventDefault();
            if (isActive) simulateKeyRelease(keyCode);
          }}
          onMouseLeave={(e) => {
            e.preventDefault();
            if (isActive) simulateKeyRelease(keyCode);
          }}
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

        {/* Q/E and Space */}
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
            <KeyButton keyCode=" " size="sm" className="min-w-16">
              ⎵
            </KeyButton>
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
                    Object.values(keyStates).filter((state) => state.pressed)
                      .length
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

                <Button
                  onClick={goToHome}
                  variant="outline"
                  disabled={!isConnected}
                  className="w-full"
                >
                  🏠 Go to Home
                </Button>
              </div>
            </CardContent>
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
              {motorConfigs.map((motor) => {
                const range = motor.maxPosition - motor.minPosition;
                const position = motor.currentPosition - motor.minPosition;
                const percentage = range > 0 ? (position / range) * 100 : 0;

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
                    <Progress value={percentage} className="h-2" />
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
                  <li>Space Gripper</li>
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

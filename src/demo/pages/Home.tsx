import React, { useState } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { PortManager } from "../components/PortManager";
import { CalibrationPanel } from "../components/CalibrationPanel";
import { isWebSerialSupported } from "../../lerobot/web/calibrate";
import type { ConnectedRobot } from "../types";

interface HomeProps {
  onGetStarted: () => void;
  connectedRobots: ConnectedRobot[];
  onConnectedRobotsChange: (robots: ConnectedRobot[]) => void;
}

export function Home({
  onGetStarted,
  connectedRobots,
  onConnectedRobotsChange,
}: HomeProps) {
  const [calibratingRobot, setCalibratingRobot] =
    useState<ConnectedRobot | null>(null);
  const isSupported = isWebSerialSupported();

  const handleCalibrate = (
    port: SerialPort,
    robotType: "so100_follower" | "so100_leader",
    robotId: string
  ) => {
    // Find the robot from connectedRobots
    const robot = connectedRobots.find((r) => r.port === port);
    if (robot) {
      setCalibratingRobot(robot);
    }
  };

  const handleFinishCalibration = () => {
    setCalibratingRobot(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🤖 LeRobot.js
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            State-of-the-art AI for real-world robotics in JavaScript
          </p>

          {!isSupported && (
            <Alert variant="destructive" className="max-w-2xl mx-auto mb-8">
              <AlertDescription>
                Web Serial API is not supported in this browser. Please use
                Chrome, Edge, or another Chromium-based browser to use this
                demo.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Main Content */}
        {calibratingRobot ? (
          <div className="max-w-6xl mx-auto">
            <div className="mb-4">
              <Button
                variant="outline"
                onClick={() => setCalibratingRobot(null)}
              >
                ← Back to Dashboard
              </Button>
            </div>
            <CalibrationPanel
              robot={calibratingRobot}
              onFinish={handleFinishCalibration}
            />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <PortManager
              onCalibrate={handleCalibrate}
              connectedRobots={connectedRobots}
              onConnectedRobotsChange={onConnectedRobotsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

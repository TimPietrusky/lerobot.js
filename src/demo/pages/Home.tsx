import { useState } from "react";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import { PortManager } from "../components/PortManager";
import { CalibrationPanel } from "../components/CalibrationPanel";
import { TeleoperationPanel } from "../components/TeleoperationPanel";
import { isWebSerialSupported } from "../../lerobot/web/calibrate";
import type { RobotConnection } from "../../lerobot/web/types/robot-connection.js";

interface HomeProps {
  connectedRobots: RobotConnection[];
  onConnectedRobotsChange: (robots: RobotConnection[]) => void;
}

export function Home({ connectedRobots, onConnectedRobotsChange }: HomeProps) {
  const [calibratingRobot, setCalibratingRobot] =
    useState<RobotConnection | null>(null);
  const [teleoperatingRobot, setTeleoperatingRobot] =
    useState<RobotConnection | null>(null);
  const isSupported = isWebSerialSupported();

  const handleCalibrate = (port: SerialPort) => {
    // Find the robot from connectedRobots
    const robot = connectedRobots.find((r) => r.port === port);
    if (robot) {
      setCalibratingRobot(robot);
    }
  };

  const handleTeleoperate = (robot: RobotConnection) => {
    setTeleoperatingRobot(robot);
  };

  const handleFinishCalibration = () => {
    setCalibratingRobot(null);
  };

  const handleFinishTeleoperation = () => {
    setTeleoperatingRobot(null);
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
        ) : teleoperatingRobot ? (
          <TeleoperationPanel
            robot={teleoperatingRobot}
            onClose={handleFinishTeleoperation}
          />
        ) : (
          <div className="max-w-6xl mx-auto">
            <PortManager
              onCalibrate={handleCalibrate}
              onTeleoperate={handleTeleoperate}
              connectedRobots={connectedRobots}
              onConnectedRobotsChange={onConnectedRobotsChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

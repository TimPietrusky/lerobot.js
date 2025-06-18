import React, { useState, useEffect } from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import { CalibrationWizard } from "../components/CalibrationWizard";
import type { ConnectedRobot } from "../types";

interface CalibrateProps {
  selectedRobot: ConnectedRobot;
  onBack: () => void;
  onHome: () => void;
}

export function Calibrate({ selectedRobot, onBack, onHome }: CalibrateProps) {
  const [calibrationStarted, setCalibrationStarted] = useState(false);

  // Auto-start calibration when component mounts
  useEffect(() => {
    if (selectedRobot && selectedRobot.isConnected) {
      setCalibrationStarted(true);
    }
  }, [selectedRobot]);

  if (!selectedRobot) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>
            No robot selected. Please go back to setup.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={onBack}>Back to Setup</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Robot Calibration</h1>
          <p className="text-muted-foreground">
            Calibrating: {selectedRobot.robotId}
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">
                  {selectedRobot.robotId}
                </CardTitle>
                <CardDescription>{selectedRobot.name}</CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={selectedRobot.isConnected ? "default" : "secondary"}
                >
                  {selectedRobot.isConnected ? "Connected" : "Disconnected"}
                </Badge>
                <Badge variant="outline">
                  {selectedRobot.robotType?.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedRobot.isConnected ? (
              <Alert variant="destructive">
                <AlertDescription>
                  Robot is not connected. Please check connection and try again.
                </AlertDescription>
              </Alert>
            ) : calibrationStarted ? (
              <CalibrationWizard
                robot={selectedRobot}
                onComplete={onHome}
                onCancel={onBack}
              />
            ) : (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <div className="text-2xl mb-4">🛠️</div>
                  <h3 className="text-lg font-semibold mb-2">
                    Ready to Calibrate
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Make sure your robot arm is in a safe position and you have
                    a clear workspace.
                  </p>
                  <Button onClick={() => setCalibrationStarted(true)} size="lg">
                    Start Calibration
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-center space-x-4">
          <Button variant="outline" onClick={onBack}>
            Back to Setup
          </Button>
          <Button variant="outline" onClick={onHome}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}

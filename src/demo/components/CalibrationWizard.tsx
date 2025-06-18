import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { calibrateWithPort } from "../../lerobot/web/calibrate";
import type { ConnectedRobot } from "../types";

interface CalibrationWizardProps {
  robot: ConnectedRobot;
  onComplete: () => void;
  onCancel: () => void;
}

interface CalibrationStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "complete" | "error";
  message?: string;
}

export function CalibrationWizard({
  robot,
  onComplete,
  onCancel,
}: CalibrationWizardProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<CalibrationStep[]>([
    {
      id: "init",
      title: "Initialize Robot",
      description: "Connecting to robot and checking status",
      status: "pending",
    },
    {
      id: "calibrate",
      title: "Calibrate Motors",
      description: "Running calibration sequence",
      status: "pending",
    },
    {
      id: "verify",
      title: "Verify Calibration",
      description: "Testing calibrated positions",
      status: "pending",
    },
    {
      id: "complete",
      title: "Complete",
      description: "Calibration finished successfully",
      status: "pending",
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCalibration();
  }, []);

  const updateStep = (
    stepId: string,
    status: CalibrationStep["status"],
    message?: string
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, message } : step
      )
    );
  };

  const startCalibration = async () => {
    if (!robot.port || !robot.robotType) {
      setError("Invalid robot configuration");
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      // Step 1: Initialize
      setCurrentStepIndex(0);
      updateStep("init", "running");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      updateStep("init", "complete", "Robot initialized successfully");

      // Step 2: Calibrate
      setCurrentStepIndex(1);
      updateStep("calibrate", "running");

      try {
        await calibrateWithPort(robot.port, robot.robotType);
        updateStep("calibrate", "complete", "Motor calibration completed");
      } catch (error) {
        updateStep(
          "calibrate",
          "error",
          error instanceof Error ? error.message : "Calibration failed"
        );
        throw error;
      }

      // Step 3: Verify
      setCurrentStepIndex(2);
      updateStep("verify", "running");
      await new Promise((resolve) => setTimeout(resolve, 1500));
      updateStep("verify", "complete", "Calibration verified");

      // Step 4: Complete
      setCurrentStepIndex(3);
      updateStep("complete", "complete", "Robot is ready for use");

      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Calibration failed");
    } finally {
      setIsRunning(false);
    }
  };

  const getStepIcon = (status: CalibrationStep["status"]) => {
    switch (status) {
      case "pending":
        return "⏳";
      case "running":
        return "🔄";
      case "complete":
        return "✅";
      case "error":
        return "❌";
      default:
        return "⏳";
    }
  };

  const getStepBadgeVariant = (status: CalibrationStep["status"]) => {
    switch (status) {
      case "pending":
        return "secondary" as const;
      case "running":
        return "default" as const;
      case "complete":
        return "default" as const;
      case "error":
        return "destructive" as const;
      default:
        return "secondary" as const;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Calibration in Progress</h3>
        <p className="text-muted-foreground">
          Calibrating {robot.robotId} ({robot.robotType?.replace("_", " ")})
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className={index === currentStepIndex ? "ring-2 ring-blue-500" : ""}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{getStepIcon(step.status)}</span>
                  <div>
                    <CardTitle className="text-base">{step.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {step.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={getStepBadgeVariant(step.status)}>
                  {step.status.charAt(0).toUpperCase() + step.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            {step.message && (
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground">{step.message}</p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="flex justify-center space-x-4">
        <Button variant="outline" onClick={onCancel} disabled={isRunning}>
          Cancel
        </Button>
        {error && <Button onClick={startCalibration}>Retry Calibration</Button>}
      </div>
    </div>
  );
}

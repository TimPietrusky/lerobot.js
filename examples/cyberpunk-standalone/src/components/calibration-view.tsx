"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  calibrate,
  releaseMotors,
  type CalibrationProcess,
  type LiveCalibrationData,
  type CalibrationResults,
  type RobotConnection,
} from "@lerobot/web";
import {
  saveCalibrationData,
  getUnifiedRobotData,
  type CalibrationMetadata,
} from "@/lib/unified-storage";
import { MotorCalibrationVisual } from "@/components/motor-calibration-visual";

interface CalibrationViewProps {
  robot: RobotConnection;
}

export function CalibrationView({ robot }: CalibrationViewProps) {
  const [status, setStatus] = useState("Ready to calibrate.");
  const [liveData, setLiveData] = useState<LiveCalibrationData | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [showHomingDialog, setShowHomingDialog] = useState(false);
  const [calibrationProcess, setCalibrationProcess] =
    useState<CalibrationProcess | null>(null);
  const [calibrationResults, setCalibrationResults] =
    useState<CalibrationResults | null>(null);
  const { toast } = useToast();

  // Load existing calibration data from unified storage
  useEffect(() => {
    if (robot.serialNumber) {
      const data = getUnifiedRobotData(robot.serialNumber);
      if (data?.calibration) {
        setCalibrationResults(data.calibration);
      }
    }
  }, [robot.serialNumber]);

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

  // Release motor torque before calibration
  const releaseMotorTorque = useCallback(async () => {
    try {
      setIsPreparing(true);
      setStatus("🔓 Releasing motor torque - joints can now be moved freely");

      await releaseMotors(robot);

      setStatus("✅ Joints are now free to move - ready to start calibration");
      toast({
        title: "Motors Released",
        description: "Robot joints can now be moved freely for calibration",
      });
    } catch (error) {
      console.error("Failed to release motor torque:", error);
      setStatus("⚠️ Could not release motor torque - try moving joints gently");
      toast({
        title: "Motor Release Warning",
        description:
          "Could not release motor torque. Try moving joints gently.",
        variant: "destructive",
      });
    } finally {
      setIsPreparing(false);
    }
  }, [robot, toast]);

  const handleStart = async () => {
    try {
      setIsPreparing(true);
      setStatus("🤖 Preparing for calibration...");

      // Release motors first
      await releaseMotorTorque();

      // Show dialog asking user to put robot in homing position
      setShowHomingDialog(true);
    } catch (error) {
      console.error("Failed to prepare for calibration:", error);
      setStatus(
        `❌ Preparation failed: ${
          error instanceof Error ? error.message : error
        }`
      );
      toast({
        title: "Preparation Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setIsPreparing(false);
    }
  };

  const handleStartCalibration = async () => {
    try {
      setShowHomingDialog(false);
      setIsCalibrating(true);
      setIsPreparing(false);
      setStatus("🤖 Starting calibration process...");

      // Start calibration process
      const process = await calibrate({
        robot,
        onLiveUpdate: (data) => {
          setLiveData(data);
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
        setCalibrationResults(result);

        // Save results to unified storage
        if (robot.serialNumber) {
          const metadata: CalibrationMetadata = {
            timestamp: new Date().toISOString(),
            readCount: Object.keys(liveData || {}).length > 0 ? 100 : 0,
          };

          // Use the result directly as CalibrationResults
          saveCalibrationData(robot.serialNumber, result, metadata);
        }

        setStatus(
          "✅ Calibration completed successfully! Configuration saved."
        );
        toast({
          title: "Calibration Complete",
          description: "Robot calibration has been saved successfully",
        });
      } finally {
        document.removeEventListener("keydown", handleKeyPress);
        setCalibrationProcess(null);
        setIsCalibrating(false);
      }
    } catch (error) {
      console.error("Calibration failed:", error);
      setStatus(
        `❌ Calibration failed: ${
          error instanceof Error ? error.message : error
        }`
      );
      toast({
        title: "Calibration Failed",
        description:
          error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
      setIsCalibrating(false);
      setCalibrationProcess(null);
    }
  };

  const handleCancelCalibration = () => {
    setShowHomingDialog(false);
    setIsPreparing(false);
    setStatus("Ready to calibrate.");
  };

  const handleFinish = async () => {
    if (calibrationProcess) {
      try {
        calibrationProcess.stop();
        toast({
          title: "Calibration Stopped",
          description: "Calibration recording has been stopped",
        });
      } catch (error) {
        console.error("Failed to stop calibration:", error);
        toast({
          title: "Stop Error",
          description: "Failed to stop calibration cleanly",
          variant: "destructive",
        });
      }
    }
  };

  const downloadJson = () => {
    if (!calibrationResults) return;

    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(calibrationResults, null, 2));
      const downloadAnchorNode = document.createElement("a");
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute(
        "download",
        `${robot.robotId}_calibration.json`
      );
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();

      toast({
        title: "Download Started",
        description: "Calibration file download has started",
      });
    } catch (error) {
      console.error("Failed to download calibration file:", error);
      toast({
        title: "Download Error",
        description: "Failed to download calibration file",
        variant: "destructive",
      });
    }
  };

  const motorData = useMemo(
    () =>
      liveData
        ? Object.entries(liveData)
        : motorNames.map((name) => [
            name,
            { current: 0, min: 4095, max: 0, range: 0 },
          ]),
    [liveData, motorNames]
  );

  return (
    <>
      <Card className="border-0 rounded-none">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-1 h-8 bg-primary"></div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">
                motor calibration
              </h3>
              <p className="text-sm text-muted-foreground font-mono">
                {status}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            {!isCalibrating ? (
              <Button
                onClick={handleStart}
                size="lg"
                disabled={isPreparing || !robot.isConnected}
              >
                {isPreparing
                  ? "Preparing..."
                  : calibrationResults
                  ? "Re-calibrate"
                  : "Start Calibration"}
              </Button>
            ) : (
              <Button onClick={handleFinish} variant="destructive" size="lg">
                Finish Recording
              </Button>
            )}
            <Button
              onClick={downloadJson}
              variant="outline"
              size="lg"
              disabled={!calibrationResults}
            >
              <Download className="w-4 h-4 mr-2" /> Download JSON
            </Button>
          </div>
        </div>
        <div className="pt-6 p-6">
          <div className="flex items-center gap-4 py-2 px-4 text-sm font-sans text-muted-foreground">
            <div className="w-40">Motor Name</div>
            <div className="flex-1">Visual Range</div>
            <div className="w-16 text-right">Current</div>
            <div className="w-16 text-right">Min</div>
            <div className="w-16 text-right">Max</div>
            <div className="w-16 text-right">Range</div>
          </div>
          <div className="border-t border-white/10">
            {motorData.map(([name, data]) => (
              <MotorCalibrationVisual
                key={name as string}
                name={name as string}
                data={
                  data as {
                    current: number;
                    min: number;
                    max: number;
                    range: number;
                  }
                }
              />
            ))}
          </div>
        </div>
      </Card>

      <AlertDialog open={showHomingDialog} onOpenChange={setShowHomingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Position Robot for Calibration</AlertDialogTitle>
            <AlertDialogDescription>
              The motors have been released and are now free to move. Please
              position the robot in its homing position:
              <br />
              <br />
              • Move all joints to their center/neutral position
              <br />
              • Ensure the robot is in a comfortable, balanced pose
              <br />
              • Make sure all motors can move freely through their full range
              <br />
              <br />
              Once the robot is positioned correctly, click "Start Calibration"
              to begin recording joint ranges.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelCalibration}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleStartCalibration}>
              Start Calibration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

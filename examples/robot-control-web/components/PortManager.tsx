import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { findPort, isWebSerialSupported } from "@lerobot/web";
import type { RobotConnection } from "@lerobot/web";

interface PortManagerProps {
  connectedRobots: RobotConnection[];
  onConnectedRobotsChange: (robots: RobotConnection[]) => void;
  onCalibrate?: (port: any) => void; // Let library handle port type
  onTeleoperate?: (robot: RobotConnection) => void;
}

export function PortManager({
  connectedRobots,
  onConnectedRobotsChange,
  onCalibrate,
  onTeleoperate,
}: PortManagerProps) {
  const [isFindingPorts, setIsFindingPorts] = useState(false);
  const [findPortsLog, setFindPortsLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load saved robots on mount by calling findPort with saved data
  useEffect(() => {
    loadSavedRobots();
  }, []);

  const loadSavedRobots = async () => {
    try {
      console.log("🔄 Loading saved robots from localStorage...");

      // Load saved robot configs for auto-connect mode
      const robotConfigs: any[] = [];
      const { getUnifiedRobotData } = await import("../lib/unified-storage");

      // Check localStorage for saved robot data
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("lerobotjs-")) {
          const serialNumber = key.replace("lerobotjs-", "");
          const robotData = getUnifiedRobotData(serialNumber);

          if (robotData) {
            console.log(
              `✅ Found saved robot: ${robotData.device_info.robotId}`
            );

            // Create robot config for auto-connect mode
            robotConfigs.push({
              robotType: robotData.device_info.robotType,
              robotId: robotData.device_info.robotId,
              serialNumber: serialNumber,
            });
          }
        }
      }

      if (robotConfigs.length > 0) {
        console.log(
          `🔄 Auto-connecting to ${robotConfigs.length} saved robots...`
        );

        // Use auto-connect mode - NO DIALOG will be shown!
        const findPortProcess = await findPort({
          robotConfigs,
          onMessage: (message) => {
            console.log(`Auto-connect: ${message}`);
          },
        });

        const reconnectedRobots = await findPortProcess.result;
        console.log(
          `✅ Auto-connected to ${
            reconnectedRobots.filter((r) => r.isConnected).length
          }/${robotConfigs.length} saved robots`
        );

        onConnectedRobotsChange(reconnectedRobots);
      } else {
        console.log("No saved robots found in localStorage");
      }
    } catch (error) {
      console.error("Failed to load saved robots:", error);
    }
  };

  const handleFindPorts = async () => {
    if (!isWebSerialSupported()) {
      setError("Web Serial API is not supported in this browser");
      return;
    }

    try {
      setIsFindingPorts(true);
      setFindPortsLog([]);
      setError(null);

      // Use clean library API - library handles everything!
      const findPortProcess = await findPort({
        onMessage: (message) => {
          setFindPortsLog((prev) => [...prev, message]);
        },
      });

      const robotConnections = await findPortProcess.result;

      // Add new robots to the list (avoid duplicates)
      const newRobots = robotConnections.filter(
        (newRobot) =>
          !connectedRobots.some(
            (existing) => existing.serialNumber === newRobot.serialNumber
          )
      );

      onConnectedRobotsChange([...connectedRobots, ...newRobots]);
      setFindPortsLog((prev) => [
        ...prev,
        `✅ Found ${newRobots.length} new robots`,
      ]);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("cancelled") ||
          error.name === "NotAllowedError")
      ) {
        console.log("Port discovery cancelled by user");
        return;
      }
      setError(error instanceof Error ? error.message : "Failed to find ports");
    } finally {
      setIsFindingPorts(false);
    }
  };

  const handleDisconnect = (index: number) => {
    const updatedRobots = connectedRobots.filter((_, i) => i !== index);
    onConnectedRobotsChange(updatedRobots);
  };

  const handleCalibrate = (robot: RobotConnection) => {
    if (!robot.robotType || !robot.robotId) {
      setError("Please configure robot type and ID first");
      return;
    }
    if (onCalibrate) {
      onCalibrate(robot.port);
    }
  };

  const handleTeleoperate = (robot: RobotConnection) => {
    if (!robot.robotType || !robot.robotId) {
      setError("Please configure robot type and ID first");
      return;
    }

    if (!robot.isConnected || !robot.port) {
      setError(
        "Robot is not connected. Please use 'Find & Connect Robots' first."
      );
      return;
    }

    // Robot is connected, proceed with teleoperation
    if (onTeleoperate) {
      onTeleoperate(robot);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔌 Robot Connection Manager</CardTitle>
        <CardDescription>
          Find and connect to your robot devices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Find Ports Button */}
          <Button
            onClick={handleFindPorts}
            disabled={isFindingPorts || !isWebSerialSupported()}
            className="w-full"
          >
            {isFindingPorts ? "Finding Robots..." : "🔍 Find & Connect Robots"}
          </Button>

          {/* Find Ports Log */}
          {findPortsLog.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-md text-sm space-y-1 max-h-32 overflow-y-auto">
              {findPortsLog.map((log, index) => (
                <div key={index} className="text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* Connected Robots */}
          <div>
            <h4 className="font-semibold mb-3">
              Connected Robots ({connectedRobots.length})
            </h4>

            {connectedRobots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-2xl mb-2">🤖</div>
                <p>No robots found</p>
                <p className="text-xs">
                  Click "Find & Connect Robots" to discover devices
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {connectedRobots.map((robot, index) => (
                  <RobotCard
                    key={robot.serialNumber || index}
                    robot={robot}
                    onDisconnect={() => handleDisconnect(index)}
                    onCalibrate={() => handleCalibrate(robot)}
                    onTeleoperate={() => handleTeleoperate(robot)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RobotCardProps {
  robot: RobotConnection;
  onDisconnect: () => void;
  onCalibrate: () => void;
  onTeleoperate: () => void;
}

function RobotCard({
  robot,
  onDisconnect,
  onCalibrate,
  onTeleoperate,
}: RobotCardProps) {
  const [calibrationStatus, setCalibrationStatus] = useState<{
    timestamp: string;
    readCount: number;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editRobotType, setEditRobotType] = useState<
    "so100_follower" | "so100_leader"
  >(robot.robotType || "so100_follower");
  const [editRobotId, setEditRobotId] = useState(robot.robotId || "");

  const isConfigured = robot.robotType && robot.robotId;

  // Check calibration status using unified storage
  useEffect(() => {
    const checkCalibrationStatus = async () => {
      if (!robot.serialNumber) return;

      try {
        const { getCalibrationStatus } = await import("../lib/unified-storage");
        const status = getCalibrationStatus(robot.serialNumber);
        setCalibrationStatus(status);
      } catch (error) {
        console.warn("Failed to check calibration status:", error);
      }
    };

    checkCalibrationStatus();
  }, [robot.serialNumber]);

  const handleSaveConfig = async () => {
    if (!editRobotId.trim() || !robot.serialNumber) return;

    try {
      const { saveRobotConfig } = await import("../lib/unified-storage");
      saveRobotConfig(
        robot.serialNumber,
        editRobotType,
        editRobotId.trim(),
        robot.usbMetadata
      );

      // Update the robot object (this should trigger a re-render)
      robot.robotType = editRobotType;
      robot.robotId = editRobotId.trim();

      setIsEditing(false);
      console.log("✅ Robot configuration saved");
    } catch (error) {
      console.error("Failed to save robot configuration:", error);
    }
  };

  const handleCancelEdit = () => {
    setEditRobotType(robot.robotType || "so100_follower");
    setEditRobotId(robot.robotId || "");
    setIsEditing(false);
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex flex-col">
            <span className="font-medium">
              {robot.robotId || robot.name || "Unnamed Robot"}
            </span>
            <span className="text-xs text-gray-500">
              {robot.robotType?.replace("_", " ") || "Not configured"}
            </span>
            {robot.serialNumber && (
              <span className="text-xs text-gray-400 font-mono">
                {robot.serialNumber.length > 20
                  ? robot.serialNumber.substring(0, 20) + "..."
                  : robot.serialNumber}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <Badge variant={robot.isConnected ? "default" : "outline"}>
              {robot.isConnected ? "Connected" : "Available"}
            </Badge>
            {calibrationStatus && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                ✅ Calibrated
              </Badge>
            )}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          Remove
        </Button>
      </div>

      {/* Robot Configuration Display (when not editing) */}
      {!isEditing && isConfigured && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div>
              <div className="font-medium text-sm">{robot.robotId}</div>
              <div className="text-xs text-gray-600">
                {robot.robotType?.replace("_", " ")}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        </div>
      )}

      {/* Configuration Prompt for unconfigured robots */}
      {!isEditing && !isConfigured && (
        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            Robot needs configuration before use
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Configure
          </Button>
        </div>
      )}

      {/* Robot Configuration Form (when editing) */}
      {isEditing && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium block mb-1">
                Robot Type
              </label>
              <select
                value={editRobotType}
                onChange={(e) =>
                  setEditRobotType(
                    e.target.value as "so100_follower" | "so100_leader"
                  )
                }
                className="w-full px-2 py-1 border rounded text-sm"
              >
                <option value="so100_follower">SO-100 Follower</option>
                <option value="so100_leader">SO-100 Leader</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Robot ID</label>
              <input
                type="text"
                value={editRobotId}
                onChange={(e) => setEditRobotId(e.target.value)}
                placeholder="e.g., my_robot"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleSaveConfig}
              disabled={!editRobotId.trim()}
            >
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Calibration Status */}
      {isConfigured && !isEditing && (
        <div className="text-sm text-gray-600">
          {calibrationStatus ? (
            <span>
              Last calibrated:{" "}
              {new Date(calibrationStatus.timestamp).toLocaleDateString()}
              <span className="text-xs ml-1">
                ({calibrationStatus.readCount} readings)
              </span>
            </span>
          ) : (
            <span>Not calibrated yet</span>
          )}
        </div>
      )}

      {/* Actions */}
      {isConfigured && !isEditing && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={calibrationStatus ? "outline" : "default"}
            onClick={onCalibrate}
          >
            {calibrationStatus ? "📏 Re-calibrate" : "📏 Calibrate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onTeleoperate}
            disabled={!robot.isConnected}
            title={
              !robot.isConnected
                ? "Use 'Find & Connect Robots' first"
                : undefined
            }
          >
            🎮 Teleoperate
          </Button>
        </div>
      )}
    </div>
  );
}

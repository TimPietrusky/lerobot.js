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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { isWebSerialSupported } from "@lerobot/web";
import type { RobotConnection } from "@lerobot/web";

/**
 * Type definitions for WebSerial API (missing from TypeScript)
 */
interface SerialPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

declare global {
  interface SerialPort {
    getInfo(): SerialPortInfo;
  }
}

interface PortManagerProps {
  connectedRobots: RobotConnection[];
  onConnectedRobotsChange: (robots: RobotConnection[]) => void;
  onCalibrate?: (
    port: SerialPort,
    robotType: "so100_follower" | "so100_leader",
    robotId: string
  ) => void;
  onTeleoperate?: (robot: RobotConnection) => void;
}

export function PortManager({
  connectedRobots,
  onConnectedRobotsChange,
  onCalibrate,
  onTeleoperate,
}: PortManagerProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFindingPorts, setIsFindingPorts] = useState(false);
  const [findPortsLog, setFindPortsLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{
    open: boolean;
    robotIndex: number;
    robotName: string;
    serialNumber: string;
  }>({
    open: false,
    robotIndex: -1,
    robotName: "",
    serialNumber: "",
  });
  // Load saved port data from localStorage on mount
  useEffect(() => {
    loadSavedPorts();
  }, []);

  // Note: Robot data is now automatically saved to unified storage when robot config is updated

  const loadSavedPorts = async () => {
    try {
      const existingPorts = await navigator.serial.getPorts();
      const restoredPorts: RobotConnection[] = [];

      for (const port of existingPorts) {
        // Get USB device metadata to determine serial number
        let serialNumber = null;
        let usbMetadata = null;

        try {
          // Get all USB devices and try to match with this serial port
          const usbDevices = await navigator.usb.getDevices();
          const portInfo = port.getInfo();

          // Try to find matching USB device by vendor/product ID
          const matchingDevice = usbDevices.find(
            (device) =>
              device.vendorId === portInfo.usbVendorId &&
              device.productId === portInfo.usbProductId
          );

          if (matchingDevice) {
            serialNumber =
              matchingDevice.serialNumber ||
              `${matchingDevice.vendorId}-${
                matchingDevice.productId
              }-${Date.now()}`;
            usbMetadata = {
              vendorId: `0x${matchingDevice.vendorId
                .toString(16)
                .padStart(4, "0")}`,
              productId: `0x${matchingDevice.productId
                .toString(16)
                .padStart(4, "0")}`,
              serialNumber: matchingDevice.serialNumber || "Generated ID",
              manufacturerName: matchingDevice.manufacturerName || "Unknown",
              productName: matchingDevice.productName || "Unknown",
              usbVersionMajor: matchingDevice.usbVersionMajor,
              usbVersionMinor: matchingDevice.usbVersionMinor,
              deviceClass: matchingDevice.deviceClass,
              deviceSubclass: matchingDevice.deviceSubclass,
              deviceProtocol: matchingDevice.deviceProtocol,
            };
            console.log("✅ Restored USB metadata for port:", serialNumber);
          }
        } catch (usbError) {
          console.log("⚠️ Could not restore USB metadata:", usbError);
          // Generate fallback if no USB metadata available
          serialNumber = `fallback-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
        }

        // Load robot configuration from unified storage
        let robotType: "so100_follower" | "so100_leader" | undefined;
        let robotId: string | undefined;
        let shouldAutoConnect = false;

        if (serialNumber) {
          try {
            const { getUnifiedRobotData } = await import(
              "../lib/unified-storage"
            );
            const unifiedData = getUnifiedRobotData(serialNumber);
            if (unifiedData?.device_info) {
              robotType = unifiedData.device_info.robotType;
              robotId = unifiedData.device_info.robotId;
              shouldAutoConnect = true;
              console.log(
                `📋 Loaded robot config from unified storage: ${robotType} (${robotId})`
              );
            }
          } catch (error) {
            console.warn("Failed to load unified robot data:", error);
          }
        }

        // Auto-connect to configured robots
        let isConnected = false;
        try {
          // Check if already open
          if (port.readable !== null && port.writable !== null) {
            isConnected = true;
            console.log("Port already open, reusing connection");
          } else if (shouldAutoConnect && robotType && robotId) {
            // Auto-open robots that have saved configuration
            console.log(
              `Auto-connecting to saved robot: ${robotType} (${robotId})`
            );
            await port.open({ baudRate: 1000000 });
            isConnected = true;
          } else {
            console.log(
              "Port found but no saved robot configuration, skipping auto-connect"
            );
            isConnected = false;
          }
        } catch (error) {
          console.log("Could not auto-connect to robot:", error);
          isConnected = false;
        }

        restoredPorts.push({
          port,
          name: getPortDisplayName(port),
          isConnected,
          robotType,
          robotId,
          serialNumber: serialNumber!,
          usbMetadata: usbMetadata || undefined,
        });
      }

      onConnectedRobotsChange(restoredPorts);
    } catch (error) {
      console.error("Failed to load saved ports:", error);
    }
  };

  const getPortDisplayName = (port: SerialPort): string => {
    try {
      const info = port.getInfo();
      if (info.usbVendorId && info.usbProductId) {
        return `USB Port (${info.usbVendorId}:${info.usbProductId})`;
      }
      if (info.usbVendorId) {
        return `Serial Port (VID:${info.usbVendorId
          .toString(16)
          .toUpperCase()})`;
      }
    } catch (error) {
      // getInfo() might not be available
    }
    return `Serial Port ${Date.now()}`;
  };

  const handleConnect = async () => {
    if (!isWebSerialSupported()) {
      setError("Web Serial API is not supported in this browser");
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Step 1: Request Web Serial port
      console.log("Step 1: Requesting Web Serial port...");
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 1000000 });

      // Step 2: Request WebUSB device for metadata
      console.log(
        "Step 2: Requesting WebUSB device for unique identification..."
      );
      let serialNumber = null;
      let usbMetadata = null;

      try {
        // Request USB device access for metadata
        const usbDevice = await navigator.usb.requestDevice({
          filters: [
            { vendorId: 0x0403 }, // FTDI
            { vendorId: 0x067b }, // Prolific
            { vendorId: 0x10c4 }, // Silicon Labs
            { vendorId: 0x1a86 }, // QinHeng Electronics (CH340)
            { vendorId: 0x239a }, // Adafruit
            { vendorId: 0x2341 }, // Arduino
            { vendorId: 0x2e8a }, // Raspberry Pi Foundation
            { vendorId: 0x1b4f }, // SparkFun
          ],
        });

        if (usbDevice) {
          serialNumber =
            usbDevice.serialNumber ||
            `${usbDevice.vendorId}-${usbDevice.productId}-${Date.now()}`;
          usbMetadata = {
            vendorId: `0x${usbDevice.vendorId.toString(16).padStart(4, "0")}`,
            productId: `0x${usbDevice.productId.toString(16).padStart(4, "0")}`,
            serialNumber: usbDevice.serialNumber || "Generated ID",
            manufacturerName: usbDevice.manufacturerName || "Unknown",
            productName: usbDevice.productName || "Unknown",
            usbVersionMajor: usbDevice.usbVersionMajor,
            usbVersionMinor: usbDevice.usbVersionMinor,
            deviceClass: usbDevice.deviceClass,
            deviceSubclass: usbDevice.deviceSubclass,
            deviceProtocol: usbDevice.deviceProtocol,
          };
          console.log("✅ USB device metadata acquired:", usbMetadata);
        }
      } catch (usbError) {
        console.log(
          "⚠️ WebUSB request failed, generating fallback ID:",
          usbError
        );
        // Generate a fallback unique ID if WebUSB fails
        serialNumber = `fallback-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        usbMetadata = {
          vendorId: "Unknown",
          productId: "Unknown",
          serialNumber: serialNumber,
          manufacturerName: "USB Metadata Not Available",
          productName: "Check browser WebUSB support",
        };
      }

      const portName = getPortDisplayName(port);

      // Step 3: Check if this robot (by serial number) is already connected
      const existingIndex = connectedRobots.findIndex(
        (robot) => robot.serialNumber === serialNumber
      );

      if (existingIndex === -1) {
        // New robot - add to list
        const newRobot: RobotConnection = {
          port,
          name: portName,
          isConnected: true,
          serialNumber: serialNumber!,
          usbMetadata: usbMetadata || undefined,
        };

        // Try to load saved robot info by serial number using unified storage
        if (serialNumber) {
          try {
            const { getRobotConfig } = await import("../lib/unified-storage");
            const savedConfig = getRobotConfig(serialNumber);
            if (savedConfig) {
              newRobot.robotType = savedConfig.robotType as
                | "so100_follower"
                | "so100_leader";
              newRobot.robotId = savedConfig.robotId;
              console.log("📋 Loaded saved robot configuration:", savedConfig);
            }
          } catch (error) {
            console.warn("Failed to load saved robot data:", error);
          }
        }

        onConnectedRobotsChange([...connectedRobots, newRobot]);
        console.log("🤖 New robot connected with ID:", serialNumber);
      } else {
        // Existing robot - update port and connection status
        const updatedRobots = connectedRobots.map((robot, index) =>
          index === existingIndex
            ? { ...robot, port, isConnected: true, name: portName }
            : robot
        );
        onConnectedRobotsChange(updatedRobots);
        console.log("🔄 Existing robot reconnected:", serialNumber);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("cancelled") ||
          error.message.includes("No port selected by the user") ||
          error.name === "NotAllowedError")
      ) {
        // User cancelled - no error message needed, just log to console
        console.log("Connection cancelled by user");
        return;
      }
      setError(
        error instanceof Error ? error.message : "Failed to connect to robot"
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (index: number) => {
    const portInfo = connectedRobots[index];
    const robotName = portInfo.robotId || portInfo.name;
    const serialNumber = portInfo.serialNumber || "unknown";

    // Show confirmation dialog
    setConfirmDeleteDialog({
      open: true,
      robotIndex: index,
      robotName,
      serialNumber,
    });
  };

  const confirmDelete = async () => {
    const { robotIndex } = confirmDeleteDialog;
    const portInfo = connectedRobots[robotIndex];

    setConfirmDeleteDialog({
      open: false,
      robotIndex: -1,
      robotName: "",
      serialNumber: "",
    });

    try {
      // Close the serial port connection
      if (portInfo.isConnected) {
        await portInfo.port.close();
      }

      // Delete from unified storage if serial number is available
      if (portInfo.serialNumber) {
        try {
          const { getUnifiedKey } = await import("../lib/unified-storage");
          const unifiedKey = getUnifiedKey(portInfo.serialNumber);

          // Remove unified storage data
          localStorage.removeItem(unifiedKey);
          console.log(`🗑️ Deleted unified robot data: ${unifiedKey}`);
        } catch (error) {
          console.warn("Failed to delete unified storage data:", error);
        }
      }

      // Remove from UI
      const updatedRobots = connectedRobots.filter((_, i) => i !== robotIndex);
      onConnectedRobotsChange(updatedRobots);

      console.log(
        `✅ Robot "${confirmDeleteDialog.robotName}" permanently removed from system`
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to remove robot"
      );
    }
  };

  const cancelDelete = () => {
    setConfirmDeleteDialog({
      open: false,
      robotIndex: -1,
      robotName: "",
      serialNumber: "",
    });
  };

  const handleUpdatePortInfo = (
    index: number,
    robotType: "so100_follower" | "so100_leader",
    robotId: string
  ) => {
    const updatedRobots = connectedRobots.map((robot, i) => {
      if (i === index) {
        const updatedRobot = { ...robot, robotType, robotId };

        // Save robot configuration using unified storage
        if (updatedRobot.serialNumber) {
          import("../lib/unified-storage")
            .then(({ saveRobotConfig }) => {
              saveRobotConfig(
                updatedRobot.serialNumber!,
                robotType,
                robotId,
                updatedRobot.usbMetadata
              );
              console.log(
                "💾 Saved robot configuration for:",
                updatedRobot.serialNumber
              );
            })
            .catch((error) => {
              console.warn("Failed to save robot configuration:", error);
            });
        }

        return updatedRobot;
      }
      return robot;
    });
    onConnectedRobotsChange(updatedRobots);
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

      // Use the new findPort API from standard library
      const { findPort } = await import("@lerobot/web");

      const findPortProcess = await findPort({
        onMessage: (message) => {
          setFindPortsLog((prev) => [...prev, message]);
        },
      });

      const robotConnections = (await findPortProcess.result) as any; // RobotConnection[] from findPort
      const robotConnection = robotConnections[0]; // Get first robot from array

      const portName = getPortDisplayName(robotConnection.port);
      setFindPortsLog((prev) => [...prev, `✅ Port ready: ${portName}`]);

      // Add to connected ports if not already there
      const existingIndex = connectedRobots.findIndex(
        (p) => p.name === portName
      );
      if (existingIndex === -1) {
        const newPort: RobotConnection = {
          port: robotConnection.port,
          name: portName,
          isConnected: true,
          robotType: robotConnection.robotType,
          robotId: robotConnection.robotId,
          serialNumber: robotConnection.serialNumber,
        };
        onConnectedRobotsChange([...connectedRobots, newPort]);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("cancelled") ||
          error.name === "NotAllowedError")
      ) {
        // User cancelled - no message needed, just log to console
        console.log("Port identification cancelled by user");
        return;
      }
      setError(error instanceof Error ? error.message : "Failed to find ports");
    } finally {
      setIsFindingPorts(false);
    }
  };

  const ensurePortIsOpen = async (robotIndex: number) => {
    const robot = connectedRobots[robotIndex];
    if (!robot) return false;

    try {
      // If port is already open, we're good
      if (robot.port.readable !== null && robot.port.writable !== null) {
        return true;
      }

      // Try to open the port
      await robot.port.open({ baudRate: 1000000 });

      // Update the robot's connection status
      const updatedRobots = connectedRobots.map((r, i) =>
        i === robotIndex ? { ...r, isConnected: true } : r
      );
      onConnectedRobotsChange(updatedRobots);

      return true;
    } catch (error) {
      console.error("Failed to open port for calibration:", error);
      setError(error instanceof Error ? error.message : "Failed to open port");
      return false;
    }
  };

  const handleCalibrate = async (port: RobotConnection) => {
    if (!port.robotType || !port.robotId) {
      setError("Please set robot type and ID before calibrating");
      return;
    }

    // Find the robot index
    const robotIndex = connectedRobots.findIndex((r) => r.port === port.port);
    if (robotIndex === -1) {
      setError("Robot not found in connected robots list");
      return;
    }

    // Ensure port is open before calibrating
    const isOpen = await ensurePortIsOpen(robotIndex);
    if (!isOpen) {
      return; // Error already set in ensurePortIsOpen
    }

    if (onCalibrate) {
      onCalibrate(port.port, port.robotType, port.robotId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>🔌 Robot Connection Manager</CardTitle>
        <CardDescription>
          Connect, identify, and manage your robot arms
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

          {/* Connection Controls */}
          <div className="flex gap-2">
            <Button
              onClick={handleConnect}
              disabled={isConnecting || !isWebSerialSupported()}
              className="flex-1"
            >
              {isConnecting ? "Connecting..." : "Connect Robot"}
            </Button>
            <Button
              variant="outline"
              onClick={handleFindPorts}
              disabled={isFindingPorts || !isWebSerialSupported()}
              className="flex-1"
            >
              {isFindingPorts ? "Finding..." : "Find Port"}
            </Button>
          </div>

          {/* Find Ports Log */}
          {findPortsLog.length > 0 && (
            <div className="bg-gray-50 p-3 rounded-md text-sm space-y-1">
              {findPortsLog.map((log, index) => (
                <div key={index} className="text-gray-700">
                  {log}
                </div>
              ))}
            </div>
          )}

          {/* Connected Ports */}
          <div>
            <h4 className="font-semibold mb-3">
              Connected Robots ({connectedRobots.length})
            </h4>

            {connectedRobots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-2xl mb-2">🤖</div>
                <p>No robots connected</p>
                <p className="text-xs">
                  Use "Connect Robot" or "Find Port" to add robots
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {connectedRobots.map((portInfo, index) => (
                  <PortCard
                    key={index}
                    portInfo={portInfo}
                    onDisconnect={() => handleDisconnect(index)}
                    onUpdateInfo={(robotType, robotId) =>
                      handleUpdatePortInfo(index, robotType, robotId)
                    }
                    onCalibrate={() => handleCalibrate(portInfo)}
                    onTeleoperate={() => onTeleoperate?.(portInfo)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDeleteDialog.open} onOpenChange={cancelDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🗑️ Permanently Delete Robot Data?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All robot data will be permanently
              deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="font-medium text-red-900 mb-2">
                Robot Information:
              </div>
              <div className="text-sm text-red-800 space-y-1">
                <div>
                  • Name:{" "}
                  <span className="font-mono">
                    {confirmDeleteDialog.robotName}
                  </span>
                </div>
                <div>
                  • Serial:{" "}
                  <span className="font-mono">
                    {confirmDeleteDialog.serialNumber}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="font-medium text-red-900 mb-2">
                This will permanently delete:
              </div>
              <div className="text-sm text-red-800 space-y-1">
                <div>• Robot configuration</div>
                <div>• Calibration data</div>
                <div>• All saved settings</div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface PortCardProps {
  portInfo: RobotConnection;
  onDisconnect: () => void;
  onUpdateInfo: (
    robotType: "so100_follower" | "so100_leader",
    robotId: string
  ) => void;
  onCalibrate: () => void;
  onTeleoperate: () => void;
}

function PortCard({
  portInfo,
  onDisconnect,
  onUpdateInfo,
  onCalibrate,
  onTeleoperate,
}: PortCardProps) {
  const [robotType, setRobotType] = useState<"so100_follower" | "so100_leader">(
    portInfo.robotType || "so100_follower"
  );
  const [robotId, setRobotId] = useState(portInfo.robotId || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [motorIDs, setMotorIDs] = useState<number[]>([]);
  const [portMetadata, setPortMetadata] = useState<any>(null);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);

  // Check for calibration using unified storage
  const getCalibrationStatus = () => {
    // Use the same serial number logic as calibration: prefer main serialNumber, fallback to USB metadata, then "unknown"
    const serialNumber =
      portInfo.serialNumber || portInfo.usbMetadata?.serialNumber || "unknown";

    try {
      // Use unified storage system with automatic migration
      import("../lib/unified-storage")
        .then(({ getCalibrationStatus }) => {
          const status = getCalibrationStatus(serialNumber);
          return status;
        })
        .catch((error) => {
          console.warn("Failed to load unified calibration data:", error);
          return null;
        });

      // For immediate synchronous return, try to get existing unified data first
      const unifiedKey = `lerobotjs-${serialNumber}`;
      const existing = localStorage.getItem(unifiedKey);
      if (existing) {
        const data = JSON.parse(existing);
        if (data.calibration?.metadata) {
          return {
            timestamp: data.calibration.metadata.timestamp,
            readCount: data.calibration.metadata.readCount,
          };
        }
      }
    } catch (error) {
      console.warn("Failed to read calibration from unified storage:", error);
    }
    return null;
  };

  const calibrationStatus = getCalibrationStatus();

  const handleSave = () => {
    if (robotId.trim()) {
      onUpdateInfo(robotType, robotId.trim());
      setIsEditing(false);
    }
  };

  // Use current values (either from props or local state)
  const currentRobotType = portInfo.robotType || robotType;
  const currentRobotId = portInfo.robotId || robotId;

  const handleCancel = () => {
    setRobotType(portInfo.robotType || "so100_follower");
    setRobotId(portInfo.robotId || "");
    setIsEditing(false);
  };

  // Scan for motor IDs and gather USB device metadata
  const scanDeviceInfo = async () => {
    if (!portInfo.port || !portInfo.isConnected) {
      console.warn("Port not connected");
      return;
    }

    setIsScanning(true);
    setMotorIDs([]);
    setPortMetadata(null);
    const foundIDs: number[] = [];

    try {
      // Try to get USB device info using WebUSB for better metadata
      let usbDeviceInfo = null;

      try {
        // First, check if we already have USB device permissions
        let usbDevices = await navigator.usb.getDevices();
        console.log("Already permitted USB devices:", usbDevices);

        // If no devices found, request permission for USB-to-serial devices
        if (usbDevices.length === 0) {
          console.log(
            "No USB permissions yet, requesting access to USB-to-serial devices..."
          );

          // Request access to common USB-to-serial chips
          try {
            const device = await navigator.usb.requestDevice({
              filters: [
                { vendorId: 0x0403 }, // FTDI
                { vendorId: 0x067b }, // Prolific
                { vendorId: 0x10c4 }, // Silicon Labs
                { vendorId: 0x1a86 }, // QinHeng Electronics (CH340)
                { vendorId: 0x239a }, // Adafruit
                { vendorId: 0x2341 }, // Arduino
                { vendorId: 0x2e8a }, // Raspberry Pi Foundation
                { vendorId: 0x1b4f }, // SparkFun
              ],
            });

            if (device) {
              usbDevices = [device];
              console.log("USB device access granted:", device);
            }
          } catch (requestError) {
            console.log(
              "User cancelled USB device selection or no devices found"
            );
            // Try requesting any device as fallback
            try {
              const anyDevice = await navigator.usb.requestDevice({
                filters: [], // Allow any USB device
              });
              if (anyDevice) {
                usbDevices = [anyDevice];
                console.log("Fallback USB device selected:", anyDevice);
              }
            } catch (fallbackError) {
              console.log("No USB device selected");
            }
          }
        }

        // Try to match with Web Serial port (this is tricky, so we'll take the first available)
        if (usbDevices.length > 0) {
          // Look for common USB-to-serial chip vendor IDs
          const serialChipVendors = [
            0x0403, // FTDI
            0x067b, // Prolific
            0x10c4, // Silicon Labs
            0x1a86, // QinHeng Electronics (CH340)
            0x239a, // Adafruit
            0x2341, // Arduino
            0x2e8a, // Raspberry Pi Foundation
            0x1b4f, // SparkFun
          ];

          const serialDevice =
            usbDevices.find((device) =>
              serialChipVendors.includes(device.vendorId)
            ) || usbDevices[0]; // Fallback to first device

          if (serialDevice) {
            usbDeviceInfo = {
              vendorId: `0x${serialDevice.vendorId
                .toString(16)
                .padStart(4, "0")}`,
              productId: `0x${serialDevice.productId
                .toString(16)
                .padStart(4, "0")}`,
              serialNumber: serialDevice.serialNumber || "Not available",
              manufacturerName: serialDevice.manufacturerName || "Unknown",
              productName: serialDevice.productName || "Unknown",
              usbVersionMajor: serialDevice.usbVersionMajor,
              usbVersionMinor: serialDevice.usbVersionMinor,
              deviceClass: serialDevice.deviceClass,
              deviceSubclass: serialDevice.deviceSubclass,
              deviceProtocol: serialDevice.deviceProtocol,
            };
            console.log("USB device info:", usbDeviceInfo);
          }
        }
      } catch (usbError) {
        console.log("WebUSB not available or no permissions:", usbError);
        // Fallback to Web Serial API info
        const portInfo_metadata = portInfo.port.getInfo();
        console.log("Serial port metadata fallback:", portInfo_metadata);
        if (Object.keys(portInfo_metadata).length > 0) {
          usbDeviceInfo = {
            vendorId: portInfo_metadata.usbVendorId
              ? `0x${portInfo_metadata.usbVendorId
                  .toString(16)
                  .padStart(4, "0")}`
              : "Not available",
            productId: portInfo_metadata.usbProductId
              ? `0x${portInfo_metadata.usbProductId
                  .toString(16)
                  .padStart(4, "0")}`
              : "Not available",
            serialNumber: "Not available via Web Serial",
            manufacturerName: "Not available via Web Serial",
            productName: "Not available via Web Serial",
          };
        }
      }

      setPortMetadata(usbDeviceInfo);

      // Get reader/writer for the port
      const reader = portInfo.port.readable?.getReader();
      const writer = portInfo.port.writable?.getWriter();

      if (!reader || !writer) {
        console.warn("Cannot access port reader/writer");
        setShowDeviceInfo(true);
        return;
      }

      // Test motor IDs 1-10 (common range for servos)
      for (let motorId = 1; motorId <= 10; motorId++) {
        try {
          // Create STS3215 ping packet
          const packet = new Uint8Array([
            0xff,
            0xff,
            motorId,
            0x02,
            0x01,
            0x00,
          ]);
          const checksum = ~(motorId + 0x02 + 0x01) & 0xff;
          packet[5] = checksum;

          // Send ping
          await writer.write(packet);

          // Wait a bit for response
          await new Promise((resolve) => setTimeout(resolve, 20));

          // Try to read response with timeout
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 50)
          );

          try {
            const result = (await Promise.race([
              reader.read(),
              timeoutPromise,
            ])) as ReadableStreamReadResult<Uint8Array>;

            if (
              result &&
              !result.done &&
              result.value &&
              result.value.length >= 6
            ) {
              const response = result.value;
              const responseId = response[2];

              // If we got a response with matching ID, motor exists
              if (responseId === motorId) {
                foundIDs.push(motorId);
              }
            }
          } catch (readError) {
            // No response from this motor ID - that's normal
          }
        } catch (error) {
          console.warn(`Error testing motor ID ${motorId}:`, error);
        }

        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      reader.releaseLock();
      writer.releaseLock();

      setMotorIDs(foundIDs);
      setShowDeviceInfo(true);
    } catch (error) {
      console.error("Device info scan failed:", error);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header with port name and status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex flex-col">
            <span className="font-medium">{portInfo.name}</span>
            {portInfo.serialNumber && (
              <span className="text-xs text-gray-500 font-mono">
                ID:{" "}
                {portInfo.serialNumber.length > 20
                  ? portInfo.serialNumber.substring(0, 20) + "..."
                  : portInfo.serialNumber}
              </span>
            )}
          </div>
          <Badge variant={portInfo.isConnected ? "default" : "outline"}>
            {portInfo.isConnected ? "Connected" : "Available"}
          </Badge>
        </div>
        <Button variant="destructive" size="sm" onClick={onDisconnect}>
          Remove
        </Button>
      </div>

      {/* Robot Info Display (when not editing) */}
      {!isEditing && currentRobotType && currentRobotId && (
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-3">
            <div>
              <div className="font-medium text-sm">{currentRobotId}</div>
              <div className="text-xs text-gray-600">
                {currentRobotType.replace("_", " ")}
              </div>
            </div>
            {calibrationStatus && (
              <Badge variant="default" className="bg-green-100 text-green-800">
                ✅ Calibrated
              </Badge>
            )}
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

      {/* Setup prompt for unconfigured robots */}
      {!isEditing && (!currentRobotType || !currentRobotId) && (
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
                value={robotType}
                onChange={(e) =>
                  setRobotType(
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
                value={robotId}
                onChange={(e) => setRobotId(e.target.value)}
                placeholder="e.g., my_robot"
                className="w-full px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={!robotId.trim()}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Calibration Status and Action */}
      {currentRobotType && currentRobotId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
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
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={calibrationStatus ? "outline" : "default"}
                onClick={onCalibrate}
                disabled={!currentRobotType || !currentRobotId}
              >
                {calibrationStatus ? "Re-calibrate" : "Calibrate"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onTeleoperate}
                disabled={
                  !currentRobotType || !currentRobotId || !portInfo.isConnected
                }
              >
                🎮 Teleoperate
              </Button>
            </div>
          </div>

          {/* Device Info Scanner */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Scan device info and motor IDs
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={scanDeviceInfo}
              disabled={!portInfo.isConnected || isScanning}
            >
              {isScanning ? "Scanning..." : "Show Device Info"}
            </Button>
          </div>

          {/* Device Info Results */}
          {showDeviceInfo && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-3">
              {/* USB Device Information */}
              {portMetadata && (
                <div>
                  <div className="text-sm font-medium mb-2">
                    📱 USB Device Info:
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Vendor ID:</span>
                      <span className="font-mono">{portMetadata.vendorId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product ID:</span>
                      <span className="font-mono">
                        {portMetadata.productId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Serial Number:</span>
                      <span className="font-mono text-green-600 font-semibold">
                        {portMetadata.serialNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Manufacturer:</span>
                      <span>{portMetadata.manufacturerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Product:</span>
                      <span>{portMetadata.productName}</span>
                    </div>
                    {portMetadata.usbVersionMajor && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">USB Version:</span>
                        <span>
                          {portMetadata.usbVersionMajor}.
                          {portMetadata.usbVersionMinor}
                        </span>
                      </div>
                    )}
                    {portMetadata.deviceClass !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Device Class:</span>
                        <span>
                          0x
                          {portMetadata.deviceClass
                            .toString(16)
                            .padStart(2, "0")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Motor IDs */}
              <div>
                <div className="text-sm font-medium mb-2">
                  🤖 Found Motor IDs:
                </div>
                {motorIDs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {motorIDs.map((id) => (
                      <Badge key={id} variant="outline" className="text-xs">
                        Motor {id}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500">
                    No motor IDs found. Check connection and power.
                  </div>
                )}
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDeviceInfo(false)}
                className="mt-2 text-xs"
              >
                Hide
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { EditRobotDialog } from "@/components/edit-robot-dialog";
import { DeviceDashboard } from "@/components/device-dashboard";
import { CalibrationView } from "@/components/calibration-view";
import { TeleoperationView } from "@/components/teleoperation-view";
import { SetupCards } from "@/components/setup-cards";
import { DocsSection } from "@/components/docs-section";
import { RoadmapSection } from "@/components/roadmap-section";
import { HardwareSupportSection } from "@/components/hardware-support-section";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import {
  findPort,
  isWebSerialSupported,
  type RobotConnection,
  type RobotConfig,
} from "@lerobot/web";
import {
  getAllSavedRobots,
  getUnifiedRobotData,
  saveDeviceInfo,
  removeRobotData,
  type DeviceInfo,
} from "@/lib/unified-storage";

function App() {
  const [view, setView] = useState<
    "dashboard" | "calibrating" | "teleoperating"
  >("dashboard");
  const [robots, setRobots] = useState<RobotConnection[]>([]);
  const [selectedRobot, setSelectedRobot] = useState<RobotConnection | null>(
    null
  );
  const [editingRobot, setEditingRobot] = useState<RobotConnection | null>(
    null
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const hardwareSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Check browser support
  const isSupported = isWebSerialSupported();

  useEffect(() => {
    if (!isSupported) {
      toast({
        title: "Browser Not Supported",
        description:
          "WebSerial API is not supported. Please use Chrome, Edge, or another Chromium-based browser.",
        variant: "destructive",
      });
    }
  }, [isSupported, toast]);

  useEffect(() => {
    const loadSavedRobots = async () => {
      if (!isSupported) return;

      try {
        setIsConnecting(true);

        // Get saved robot configurations
        const savedRobots = getAllSavedRobots();

        if (savedRobots.length > 0) {
          const robotConfigs: RobotConfig[] = savedRobots.map((device) => ({
            robotType: device.robotType as "so100_follower" | "so100_leader",
            robotId: device.robotId,
            serialNumber: device.serialNumber,
          }));

          // Auto-connect to saved robots
          const findPortProcess = await findPort({
            robotConfigs,
            onMessage: (msg: string) => {
              console.log("Connection message:", msg);
            },
          });

          const reconnectedRobots = await findPortProcess.result;

          // Merge saved device info (names, etc.) with fresh connection data
          const robotsWithSavedInfo = reconnectedRobots.map((robot) => {
            const savedData = getUnifiedRobotData(robot.serialNumber || "");
            if (savedData?.device_info) {
              return {
                ...robot,
                robotId: savedData.device_info.robotId,
                name: savedData.device_info.robotId, // Use the saved custom name
                robotType: savedData.device_info.robotType as
                  | "so100_follower"
                  | "so100_leader",
              };
            }
            return robot;
          });

          setRobots(robotsWithSavedInfo);
        }
      } catch (error) {
        console.error("Failed to load saved robots:", error);
        toast({
          title: "Connection Error",
          description: "Failed to reconnect to saved robots",
          variant: "destructive",
        });
      } finally {
        setIsConnecting(false);
      }
    };

    loadSavedRobots();
  }, [isSupported, toast]);

  const handleFindNewRobots = async () => {
    if (!isSupported) {
      toast({
        title: "Browser Not Supported",
        description: "WebSerial API is required for robot connection",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);

      // Interactive mode - show browser dialog
      const findPortProcess = await findPort({
        onMessage: (msg: string) => {
          console.log("Find port message:", msg);
        },
      });

      const newRobots = await findPortProcess.result;

      if (newRobots.length > 0) {
        setRobots((prev: RobotConnection[]) => {
          const existingSerialNumbers = new Set(
            prev.map((r: RobotConnection) => r.serialNumber)
          );
          const uniqueNewRobots = newRobots.filter(
            (r: RobotConnection) => !existingSerialNumbers.has(r.serialNumber)
          );

          // Auto-edit first new robot for configuration
          if (uniqueNewRobots.length > 0) {
            setEditingRobot(uniqueNewRobots[0]);
          }

          return [...prev, ...uniqueNewRobots];
        });

        toast({
          title: "Robots Found",
          description: `Found ${newRobots.length} robot(s)`,
        });
      } else {
        toast({
          title: "No Robots Found",
          description: "No compatible devices detected",
        });
      }
    } catch (error) {
      console.error("Failed to find robots:", error);
      toast({
        title: "Connection Error",
        description: "Failed to find robots. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleUpdateRobot = (updatedRobot: RobotConnection) => {
    // Save device info to unified storage
    if (updatedRobot.serialNumber && updatedRobot.robotId) {
      const deviceInfo: DeviceInfo = {
        serialNumber: updatedRobot.serialNumber,
        robotType: updatedRobot.robotType || "so100_follower",
        robotId: updatedRobot.robotId,
        usbMetadata: updatedRobot.usbMetadata
          ? {
              vendorId: parseInt(updatedRobot.usbMetadata.vendorId || "0", 16),
              productId: parseInt(
                updatedRobot.usbMetadata.productId || "0",
                16
              ),
              serialNumber: updatedRobot.usbMetadata.serialNumber,
              manufacturer: updatedRobot.usbMetadata.manufacturerName,
              product: updatedRobot.usbMetadata.productName,
            }
          : undefined,
      };
      saveDeviceInfo(updatedRobot.serialNumber, deviceInfo);
    }

    setRobots((prev) =>
      prev.map((r) =>
        r.serialNumber === updatedRobot.serialNumber ? updatedRobot : r
      )
    );
    setEditingRobot(null);
  };

  const handleRemoveRobot = (robotId: string) => {
    const robot = robots.find((r) => r.robotId === robotId);
    if (robot?.serialNumber) {
      removeRobotData(robot.serialNumber);
    }

    setRobots((prev) => prev.filter((r) => r.robotId !== robotId));

    toast({
      title: "Robot Removed",
      description: `${robotId} has been removed from the registry`,
    });
  };

  const handleCalibrate = (robot: RobotConnection) => {
    if (!robot.isConnected) {
      toast({
        title: "Robot Not Connected",
        description: "Please connect the robot before calibrating",
        variant: "destructive",
      });
      return;
    }

    setSelectedRobot(robot);
    setView("calibrating");
  };

  const handleTeleoperate = (robot: RobotConnection) => {
    if (!robot.isConnected) {
      toast({
        title: "Robot Not Connected",
        description: "Please connect the robot before teleoperating",
        variant: "destructive",
      });
      return;
    }

    setSelectedRobot(robot);
    setView("teleoperating");
  };

  const handleCloseSubView = () => {
    setSelectedRobot(null);
    setView("dashboard");
  };

  const scrollToHardware = () => {
    hardwareSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const renderView = () => {
    switch (view) {
      case "calibrating":
        return selectedRobot && <CalibrationView robot={selectedRobot} />;
      case "teleoperating":
        return selectedRobot && <TeleoperationView robot={selectedRobot} />;
      case "dashboard":
      default:
        return (
          <div className="space-y-12">
            <DeviceDashboard
              robots={robots}
              onCalibrate={handleCalibrate}
              onTeleoperate={handleTeleoperate}
              onRemove={handleRemoveRobot}
              onEdit={setEditingRobot}
              onFindNew={handleFindNewRobots}
              isConnecting={isConnecting}
              onScrollToHardware={scrollToHardware}
            />
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-primary font-mono tracking-wider mb-2 uppercase">
                  install
                </h2>
                <p className="text-sm text-muted-foreground font-mono">
                  Choose your preferred development environment
                </p>
              </div>
              <SetupCards />
            </div>
            <DocsSection />
            <RoadmapSection />
            <div ref={hardwareSectionRef}>
              <HardwareSupportSection />
            </div>
          </div>
        );
    }
  };

  const PageHeader = () => {
    return (
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-4">
          <div>
            {view === "calibrating" && selectedRobot ? (
              <h1 className="font-mono text-4xl font-bold tracking-wider">
                <span className="text-muted-foreground uppercase">
                  calibrate:
                </span>{" "}
                <span
                  className="text-primary text-glitch uppercase"
                  data-text={selectedRobot.robotId}
                >
                  {selectedRobot.robotId?.toUpperCase()}
                </span>
              </h1>
            ) : view === "teleoperating" && selectedRobot ? (
              <h1 className="font-mono text-4xl font-bold tracking-wider">
                <span className="text-muted-foreground uppercase">
                  teleoperate:
                </span>{" "}
                <span
                  className="text-primary text-glitch uppercase"
                  data-text={selectedRobot.robotId}
                >
                  {selectedRobot.robotId?.toUpperCase()}
                </span>
              </h1>
            ) : (
              <h1
                className="font-mono text-4xl font-bold text-primary tracking-wider text-glitch uppercase"
                data-text="dashboard"
              >
                DASHBOARD
              </h1>
            )}
            <div className="h-6 flex items-center">
              {view !== "dashboard" ? (
                <button
                  onClick={handleCloseSubView}
                  className="flex items-center gap-2 text-sm text-muted-foreground font-mono hover:text-primary transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="uppercase">back to dashboard</span>
                </button>
              ) : (
                <p className="text-sm text-muted-foreground font-mono">{""} </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      <Header />
      <main className="flex-grow container mx-auto py-12 px-4 md:px-6">
        <PageHeader />
        {renderView()}
        <EditRobotDialog
          robot={editingRobot}
          isOpen={!!editingRobot}
          onOpenChange={(open) => !open && setEditingRobot(null)}
          onSave={handleUpdateRobot}
        />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}

export default App;

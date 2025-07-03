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
import { lerobot } from "@/lib/mock-api";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { RobotConnection } from "@/types/robot";

function App() {
  const [view, setView] = useState<
    "dashboard" | "calibrating" | "teleoperating"
  >("dashboard");
  const [robots, setRobots] = useLocalStorage<RobotConnection[]>(
    "connected-robots",
    []
  );
  const [selectedRobot, setSelectedRobot] = useState<RobotConnection | null>(
    null
  );
  const [editingRobot, setEditingRobot] = useState<RobotConnection | null>(
    null
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const hardwareSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadSavedRobots = async () => {
      const robotConfigs = robots.map(({ port, ...config }) => config);
      if (robotConfigs.length > 0) {
        const findPortProcess = await lerobot.findPort({
          robotConfigs,
          onMessage: (msg) => setLogs((prev) => [...prev, msg]),
        });
        const reconnectedRobots = await findPortProcess.result;
        setRobots(reconnectedRobots);
      }
      setIsConnecting(false);
    };
    loadSavedRobots();
  }, []);

  const handleFindNewRobots = async () => {
    setIsConnecting(true);
    const findPortProcess = await lerobot.findPort({
      onMessage: (msg) => setLogs((prev) => [...prev, msg]),
    });
    const newRobots = await findPortProcess.result;
    setRobots((prev) => {
      const existingIds = new Set(prev.map((r) => r.robotId));
      const uniqueNewRobots = newRobots.filter(
        (r) => !existingIds.has(r.robotId)
      );
      return [...prev, ...uniqueNewRobots];
    });
    if (newRobots.length > 0) {
      setEditingRobot(newRobots[0]);
    }
    setIsConnecting(false);
  };

  const handleUpdateRobot = (updatedRobot: RobotConnection) => {
    setRobots((prev) =>
      prev.map((r) => (r.robotId === updatedRobot.robotId ? updatedRobot : r))
    );
    setEditingRobot(null);
  };

  const handleRemoveRobot = (robotId: string) => {
    setRobots((prev) => prev.filter((r) => r.robotId !== robotId));
  };

  const handleCalibrate = (robot: RobotConnection) => {
    setSelectedRobot(robot);
    setView("calibrating");
  };

  const handleTeleoperate = (robot: RobotConnection) => {
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
    let title = "DASHBOARD";
    if (view === "calibrating" && selectedRobot) {
      title = `CALIBRATE: ${selectedRobot.name.toUpperCase()}`;
    } else if (view === "teleoperating" && selectedRobot) {
      title = `TELEOPERATE: ${selectedRobot.name.toUpperCase()}`;
    }

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
                  data-text={selectedRobot.name}
                >
                  {selectedRobot.name.toUpperCase()}
                </span>
              </h1>
            ) : view === "teleoperating" && selectedRobot ? (
              <h1 className="font-mono text-4xl font-bold tracking-wider">
                <span className="text-muted-foreground uppercase">
                  teleoperate:
                </span>{" "}
                <span
                  className="text-primary text-glitch uppercase"
                  data-text={selectedRobot.name}
                >
                  {selectedRobot.name.toUpperCase()}
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
    <div className="flex flex-col min-h-screen font-sans scanline-overlay">
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
    </div>
  );
}

export default App;

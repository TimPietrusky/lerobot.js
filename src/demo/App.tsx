import React, { useState } from "react";
import { Home } from "./pages/Home";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { RobotConnection } from "../lerobot/web/find_port.js";

export function App() {
  const [connectedRobots, setConnectedRobots] = useState<RobotConnection[]>([]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        <Home
          onGetStarted={() => {}} // No longer needed
          connectedRobots={connectedRobots}
          onConnectedRobotsChange={setConnectedRobots}
        />
      </div>
    </ErrorBoundary>
  );
}

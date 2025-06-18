import React, { useState } from "react";
import { Home } from "./pages/Home";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { ConnectedRobot } from "./types";

export function App() {
  const [connectedRobots, setConnectedRobots] = useState<ConnectedRobot[]>([]);

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

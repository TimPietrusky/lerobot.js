import React from "react";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Badge } from "../components/ui/badge";
import type { ConnectedRobot } from "../types";

interface SetupProps {
  connectedRobots: ConnectedRobot[];
  onBack: () => void;
  onNext: (robot: ConnectedRobot) => void;
}

export function Setup({ connectedRobots, onBack, onNext }: SetupProps) {
  const configuredRobots = connectedRobots.filter(
    (r) => r.robotType && r.robotId
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Robot Setup</h1>
          <p className="text-muted-foreground">
            Select a connected robot to calibrate
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Connected Robots</h2>
            <Badge variant="outline">{configuredRobots.length} ready</Badge>
          </div>

          {configuredRobots.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="text-muted-foreground space-y-2">
                  <p>No configured robots found.</p>
                  <p className="text-sm">
                    Go back to the home page to connect and configure your
                    robots.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {configuredRobots.map((robot, index) => (
                <Card
                  key={index}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {robot.robotId}
                        </CardTitle>
                        <CardDescription>{robot.name}</CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={robot.isConnected ? "default" : "outline"}
                        >
                          {robot.isConnected ? "Connected" : "Available"}
                        </Badge>
                        <Badge variant="outline">
                          {robot.robotType?.replace("_", " ")}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => onNext(robot)} className="w-full">
                      Calibrate This Robot
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={onBack}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}

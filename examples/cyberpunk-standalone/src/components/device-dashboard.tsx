"use client";

import { useState } from "react";
import {
  Settings,
  Gamepad2,
  Trash2,
  Pencil,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import HudCorners from "@/components/hud-corners";
import { getUnifiedRobotData } from "@/lib/unified-storage";
import type { RobotConnection } from "@/types/robot";

interface DeviceDashboardProps {
  robots: RobotConnection[];
  onCalibrate: (robot: RobotConnection) => void;
  onTeleoperate: (robot: RobotConnection) => void;
  onRemove: (robotId: string) => void;
  onEdit: (robot: RobotConnection) => void;
  onFindNew: () => void;
  isConnecting: boolean;
  onScrollToHardware: () => void;
}

export function DeviceDashboard({
  robots,
  onCalibrate,
  onTeleoperate,
  onRemove,
  onEdit,
  onFindNew,
  isConnecting,
  onScrollToHardware,
}: DeviceDashboardProps) {
  const [robotToRemove, setRobotToRemove] = useState<RobotConnection | null>(
    null
  );

  const handleRemoveClick = (robot: RobotConnection) => {
    setRobotToRemove(robot);
  };

  const handleConfirmRemove = () => {
    if (robotToRemove) {
      onRemove(
        robotToRemove.robotId || robotToRemove.serialNumber || "unknown"
      );
      setRobotToRemove(null);
    }
  };

  const handleCancelRemove = () => {
    setRobotToRemove(null);
  };
  return (
    <>
      <Card className="border-0 rounded-none">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-1 h-8 bg-primary"></div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">
                device registry
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground font-mono">
                  currently supports SO-100{" "}
                </span>
                <button
                  onClick={onScrollToHardware}
                  className="text-xs text-primary hover:text-accent transition-colors underline font-mono flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  add more devices
                </button>
              </div>
            </div>
          </div>
          {robots.length > 0 && (
            <Button
              onClick={onFindNew}
              disabled={isConnecting}
              size="lg"
              className="font-mono uppercase"
            >
              <Plus className="w-4 h-4 mr-2" />
              add unit
            </Button>
          )}
        </div>

        <div className="pt-6 p-6">
          {robots.length === 0 ? (
            <div className="relative">
              <HudCorners className="p-16">
                <div className="text-center font-mono">
                  <div className="mb-6">
                    {isConnecting ? (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 border-2 border-primary/50 rounded-lg flex items-center justify-center animate-pulse">
                          <Plus className="w-8 h-8 text-primary animate-spin" />
                        </div>
                        <h4 className="text-xl text-primary mb-2 tracking-wider uppercase">
                          scanning for units
                        </h4>
                        <p className="text-sm text-muted-foreground mb-8">
                          searching for available devices...
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 mx-auto mb-4 border-2 border-dashed border-primary/50 rounded-lg flex items-center justify-center">
                          <Plus className="w-8 h-8 text-primary/50" />
                        </div>
                        <h4 className="text-xl text-primary mb-2 tracking-wider uppercase">
                          no units detected
                        </h4>

                        <Button
                          onClick={onFindNew}
                          size="lg"
                          className="font-mono uppercase"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          add unit
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </HudCorners>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {robots.map((robot) => (
                <HudCorners key={robot.robotId}>
                  <Card className="flex flex-col h-full">
                    <div className="p-4 border-b border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="text-2xl font-bold text-primary font-mono tracking-wider">
                            {robot.name}
                          </h4>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-primary/50 bg-primary/20 text-primary font-mono text-xs",
                            robot.isConnected && "animate-pulse-slow"
                          )}
                        >
                          {robot.isConnected ? "ONLINE" : "OFFLINE"}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex-grow p-4">
                      <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-muted-foreground/40 uppercase">
                            serial number
                          </span>
                          <div className="text-muted-foreground uppercase/70">
                            {robot.serialNumber}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground/40 uppercase">
                            type
                          </span>
                          <div className="text-muted-foreground uppercase/70">
                            {robot.robotType}
                          </div>
                        </div>
                      </div>
                    </div>

                    <CardFooter className="p-4 border-t border-white/10 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(robot)}
                        className="font-mono text-xs uppercase px-2"
                      >
                        <Pencil className="w-3 h-3 mr-0.5" /> edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onCalibrate(robot)}
                        className="font-mono text-xs uppercase px-2"
                      >
                        <Settings className="w-3 h-3 mr-0.5" />
                        {robot.serialNumber &&
                        getUnifiedRobotData(robot.serialNumber)?.calibration
                          ? "re-calibrate"
                          : "calibrate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTeleoperate(robot)}
                        className="font-mono text-xs uppercase px-2"
                      >
                        <Gamepad2 className="w-3 h-3 mr-0.5" /> control
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveClick(robot)}
                        className="font-mono text-xs uppercase px-2"
                      >
                        <Trash2 className="w-3 h-3 mr-0.5" /> remove
                      </Button>
                    </CardFooter>
                  </Card>
                </HudCorners>
              ))}
            </div>
          )}
        </div>
      </Card>

      <AlertDialog
        open={!!robotToRemove}
        onOpenChange={() => setRobotToRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Robot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove{" "}
              <strong>{robotToRemove?.name || robotToRemove?.robotId}</strong>{" "}
              from the device registry?
              <br />
              <br />
              This will permanently delete all stored calibration data and
              settings for this robot. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRemove}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove Robot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

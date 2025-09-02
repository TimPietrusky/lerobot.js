"use client";
import { CheckCircle, Clock, Loader2, Target, Github } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RoadmapItem {
  title: string;
  description: string;
  status: "completed" | "in_progress" | "planned";
}

const roadmapItems: RoadmapItem[] = [
  {
    title: "findPort",
    description: "WebSerial-based robot detection and connection management",
    status: "completed",
  },
  {
    title: "releaseMotors",
    description: "Release motor torque for safe manual positioning and setup",
    status: "completed",
  },
  {
    title: "calibrate",
    description:
      "Real-time joint calibration with visual feedback and data export",
    status: "completed",
  },
  {
    title: "teleoperate",
    description: "Manual robot control with keyboard and slider inputs",
    status: "completed",
  },
  {
    title: "node/cli",
    description: "Node.js CLI tools for robot control and automation scripts",
    status: "completed",
  },
  {
    title: "SO-100 leader arm",
    description: "Leader arm teleoperation support for intuitive robot control",
    status: "in_progress",
  },
  {
    title: "record",
    description: "Record robot trajectories and sensor data to create datasets",
    status: "in_progress",
  },
  {
    title: "replay",
    description:
      "Replay any recorded episode or episodes from existing datasets",
    status: "planned",
  },
  {
    title: "train",
    description: "Run training based on a given dataset to create a policy",
    status: "planned",
  },
  {
    title: "eval",
    description:
      "Run inference using trained policies for autonomous operation",
    status: "planned",
  },
];

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: "COMPLETED",
    dotColor: "bg-green-500 dark:bg-green-400",
    textColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10 dark:bg-green-400/5",
    borderColor: "border-green-500/30 dark:border-green-400/20",
  },
  in_progress: {
    icon: Loader2,
    label: "IN PROGRESS",
    dotColor: "bg-orange-500 dark:bg-orange-400",
    textColor: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10 dark:bg-orange-400/5",
    borderColor: "border-orange-500/30 dark:border-orange-400/20",
  },
  planned: {
    icon: Clock,
    label: "PLANNED",
    dotColor: "bg-slate-500 dark:bg-muted-foreground",
    textColor: "text-slate-600 dark:text-muted-foreground",
    bgColor: "bg-slate-500/10 dark:bg-muted-foreground/5",
    borderColor: "border-slate-500/30 dark:border-muted-foreground/20",
  },
};

export function RoadmapSection() {
  const completedCount = roadmapItems.filter(
    (item) => item.status === "completed"
  ).length;
  const inProgressCount = roadmapItems.filter(
    (item) => item.status === "in_progress"
  ).length;
  const totalCount = roadmapItems.length;

  return (
    <div className="font-mono">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-wider mb-2 uppercase flex items-center gap-3">
          <Target className="w-6 h-6" />
          Roadmap
        </h2>
        <p className="text-sm text-muted-foreground">
          our goal is to provide{" "}
          <a
            href="https://huggingface.co/docs/lerobot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-accent transition-colors underline"
          >
            LeRobot
          </a>
          's simple, easy-to-use Python functions for the JavaScript community
        </p>
      </div>

      <div className="bg-gradient-to-br from-muted/60 to-muted/40 dark:from-black/40 dark:to-black/20 border border-primary/20 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary/30 dark:bg-primary/10 border-b border-primary/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full"></div>
                  <span className="text-green-600 dark:text-green-400 text-xs">
                    {completedCount} COMPLETED
                  </span>
                </div>
                <div className="w-px h-4 bg-border dark:bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 dark:bg-orange-400 rounded-full animate-pulse"></div>
                  <span className="text-orange-600 dark:text-orange-400 text-xs">
                    {inProgressCount} IN PROGRESS
                  </span>
                </div>
                <div className="w-px h-4 bg-border dark:bg-white/10"></div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-500 dark:bg-muted-foreground rounded-full"></div>
                  <span className="text-slate-600 dark:text-muted-foreground text-xs">
                    {totalCount - completedCount - inProgressCount} PLANNED
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              PROGRESS: {Math.round((completedCount / totalCount) * 100)}%
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-muted/50 dark:bg-black/30 p-4 border-b border-border dark:border-white/10">
          <div className="w-full bg-muted/80 dark:bg-black/40 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-primary dark:from-green-400 dark:to-primary transition-all duration-1000 ease-out"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Items List */}
        <div className="p-6">
          <div className="space-y-3">
            {roadmapItems.map((item, index) => {
              const config = statusConfig[item.status];
              const StatusIcon = config.icon;

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded border transition-all hover:bg-muted/30 dark:hover:bg-white/5",
                    config.bgColor,
                    config.borderColor
                  )}
                >
                  {/* Number */}
                  <div className="text-muted-foreground/50 text-xs font-mono min-w-[2rem] text-right">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("font-bold text-lg", config.textColor)}>
                      {item.title}
                      {item.title !== "SO-100 leader arm" ? "()" : ""}
                    </h4>
                    <p className="text-muted-foreground text-sm mt-1">
                      {item.description}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-bold tracking-wider border-0 px-3 py-1 flex-shrink-0",
                      config.textColor,
                      config.bgColor
                    )}
                  >
                    {config.label}
                  </Badge>

                  {/* Status Icon */}
                  <StatusIcon
                    className={cn(
                      "w-4 h-4 flex-shrink-0 ml-3",
                      config.textColor,
                      item.status === "in_progress" && "animate-spin"
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 dark:bg-black/30 border-t border-gray-300 dark:border-white/10 p-4">
          <p className="text-muted-foreground text-sm">
            want to help? LeRobot.js is open source on{" "}
            <a
              href="https://github.com/lerobot/lerobot.js"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent transition-colors underline"
            >
              <Github className="h-4 w-4 inline align-text-bottom mr-1" />
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

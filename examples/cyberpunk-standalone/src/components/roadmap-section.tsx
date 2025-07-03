"use client"
import { CheckCircle, Clock, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface RoadmapItem {
  title: string
  description: string
  status: "completed" | "planned"
}

const roadmapItems: RoadmapItem[] = [
  {
    title: "findPort",
    description: "WebSerial-based robot detection and connection management",
    status: "completed",
  },
  {
    title: "calibrate",
    description: "Real-time joint calibration with visual feedback and data export",
    status: "completed",
  },
  {
    title: "teleoperate",
    description: "Manual robot control with keyboard and slider inputs",
    status: "completed",
  },
  {
    title: "record",
    description: "Record robot trajectories and sensor data to create datasets",
    status: "planned",
  },
  {
    title: "replay",
    description: "Replay any recorded episode or episodes from existing datasets",
    status: "planned",
  },
  {
    title: "train",
    description: "Run training based on a given dataset to create a policy",
    status: "planned",
  },
  {
    title: "eval",
    description: "Run inference using trained policies for autonomous operation",
    status: "planned",
  },
]

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: "COMPLETED",
    dotColor: "bg-green-500 dark:bg-green-400",
    textColor: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10 dark:bg-green-400/5",
    borderColor: "border-green-500/30 dark:border-green-400/20",
  },
  planned: {
    icon: Clock,
    label: "PLANNED",
    dotColor: "bg-slate-500 dark:bg-muted-foreground",
    textColor: "text-slate-600 dark:text-muted-foreground",
    bgColor: "bg-slate-500/10 dark:bg-muted-foreground/5",
    borderColor: "border-slate-500/30 dark:border-muted-foreground/20",
  },
}

export function RoadmapSection() {
  const completedCount = roadmapItems.filter((item) => item.status === "completed").length
  const totalCount = roadmapItems.length

  return (
    <div className="font-mono">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary tracking-wider mb-2 uppercase flex items-center gap-3">
          <Target className="w-6 h-6" />
          Roadmap
        </h2>
        <p className="text-sm text-muted-foreground">lfg o7</p>
      </div>

      <div className="bg-gradient-to-br from-muted/60 to-muted/40 dark:from-black/40 dark:to-black/20 border border-primary/20 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-primary/30 dark:bg-primary/10 border-b border-primary/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-primary font-bold text-lg tracking-wider">SYSTEM OBJECTIVES</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-600 dark:text-green-400 text-sm">{completedCount} ACTIVE</span>
                <div className="w-2 h-2 bg-slate-500 dark:bg-muted-foreground rounded-full"></div>
                <span className="text-slate-600 dark:text-muted-foreground text-sm">
                  {totalCount - completedCount} QUEUED
                </span>
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
              const config = statusConfig[item.status]
              const StatusIcon = config.icon

              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded border transition-all hover:bg-muted/30 dark:hover:bg-white/5",
                    config.bgColor,
                    config.borderColor,
                  )}
                >
                  {/* Number */}
                  <div className="text-muted-foreground/50 text-xs font-mono min-w-[2rem] text-right">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className={cn("font-bold text-lg", config.textColor)}>{item.title}()</h4>
                    <p className="text-muted-foreground text-sm mt-1">{item.description}</p>
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-bold tracking-wider border-0 px-3 py-1 flex-shrink-0",
                      config.textColor,
                      config.bgColor,
                    )}
                  >
                    {config.label}
                  </Badge>

                  {/* Status Icon */}
                  <StatusIcon className={cn("w-4 h-4 flex-shrink-0 ml-3", config.textColor)} />
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/50 dark:bg-black/30 border-t border-border dark:border-white/10 p-4">
          <p className="text-muted-foreground text-sm">
            <span className="text-cyan-600 dark:text-accent-cyan">REFERENCE:</span> functions based on the original{" "}
            <a
              href="https://huggingface.co/docs/lerobot"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent transition-colors underline"
            >
              LeRobot
            </a>{" "}
            (python) and adapted for web robotic ai
          </p>
        </div>
      </div>
    </div>
  )
}

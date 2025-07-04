"use client";

import { Cpu, MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import HudCorners from "@/components/hud-corners";

const supportedHardware = [
  {
    name: "SO-100",
    status: "supported",
    description:
      "6-DOF robotic arm with gripper, leader/follower configuration",
  },
];

export function HardwareSupportSection() {
  return (
    <div className="font-mono">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-wider mb-2 uppercase flex items-center gap-3">
          <Cpu className="w-6 h-6" />
          Hardware Support
        </h2>
        <p className="text-sm text-muted-foreground">
          {"making sure that robotic ai is accessible to everyone"}
        </p>
      </div>

      <div className="space-y-8">
        {/* Currently Supported */}
        <HudCorners color="primary" size="sm" layer="front">
          <div className="bg-muted/40 dark:bg-black/30 border border-primary/30 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5" />
              Currently Supported
            </h3>

            <div className="space-y-4">
              {supportedHardware.map((robot, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-muted/50 dark:bg-black/20 rounded-lg border border-border dark:border-white/10"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-bold text-primary">{robot.name}</h4>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {robot.description}
                    </p>
                  </div>

                  {/* Sponsored By Section */}
                  <div className="flex flex-col items-end gap-2 ml-6">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">
                      Sponsored by
                    </span>
                    <a
                      href="https://partabot.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block hover:opacity-80 transition-opacity"
                    >
                      <img
                        src="partabot-logo.png"
                        alt="Partabot.com"
                        width="100"
                        height="32"
                        className="h-6 w-auto invert dark:invert-0"
                      />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </HudCorners>

        {/* Add New Hardware */}
        <HudCorners color="whiteMuted" size="sm" layer="front">
          <div className="bg-muted/40 dark:bg-black/30 border border-muted/30 p-6 rounded-lg">
            <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Add New Hardware Support
            </h3>

            <div className="space-y-6">
              <div>
                <p className="text-muted-foreground mb-4">
                  please provide us with access to different robot hardware, so
                  we can add them to lerobot.js. join the LeRobot Discord and DM
                  me!
                </p>

                <div className="bg-muted/60 dark:bg-black/40 border border-border dark:border-white/10 rounded-lg p-4 mb-4">
                  <h4 className="font-bold text-primary mb-2">
                    How to contribute hardware support:
                  </h4>
                  <ul className="text-foreground/80 dark:text-muted-foreground text-sm space-y-1 list-disc list-inside">
                    <li>Loan or donate hardware for development</li>
                    <li>Provide technical documentation and APIs</li>
                    <li>Contribute code for new robot integrations</li>
                    <li>Help with testing and validation</li>
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild className="font-mono">
                    <a
                      href="https://discord.gg/s3KuuzsPFb"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      LeRobot Discord → dm @NERDDISCO
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </HudCorners>
      </div>
    </div>
  );
}

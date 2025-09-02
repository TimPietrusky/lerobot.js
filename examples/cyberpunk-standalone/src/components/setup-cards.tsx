"use client";
import { useState } from "react";
import {
  Copy,
  Package,
  Clock,
  Check,
  Terminal,
  Command,
  Server,
  Github,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import HudCorners from "@/components/hud-corners";
import { cn } from "@/lib/utils";

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";
type CLIInstallMode = "npm" | "npx";

interface PackageInstallerProps {
  packageName: string;
  disabled?: boolean;
}

function PackageInstaller({
  packageName,
  disabled = false,
}: PackageInstallerProps) {
  const [selectedPM, setSelectedPM] = useState<PackageManager>("pnpm");
  const [copied, setCopied] = useState(false);

  const packageManagers: {
    value: PackageManager;
    label: string;
    command: string;
  }[] = [
    { value: "pnpm", label: "pnpm", command: `pnpm add ${packageName}` },
    { value: "npm", label: "npm", command: `npm i ${packageName}` },
    { value: "yarn", label: "yarn", command: `yarn add ${packageName}` },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const currentCommand =
    packageManagers.find((pm) => pm.value === selectedPM)?.command || "";

  return (
    <div className="max-w-md">
      <div className="space-y-3">
        <div className="flex gap-1 w-fit">
          {packageManagers.map((pm) => (
            <Button
              key={pm.value}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedPM(pm.value)}
              disabled={disabled}
              className={cn(
                "font-mono text-xs px-3 min-w-[60px] h-8 border transition-colors",
                selectedPM === pm.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-input hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {pm.label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <div
            className={cn(
              "border rounded-md p-3 font-mono text-sm transition-colors",
              disabled
                ? "bg-muted/60 dark:bg-black/20 border-dashed border-muted/40 dark:border-muted/20 text-muted-foreground/70 dark:text-muted-foreground/50"
                : "bg-muted/60 dark:bg-black/40 border-border dark:border-white/10 text-foreground dark:text-primary"
            )}
          >
            {currentCommand}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(currentCommand)}
            disabled={disabled}
            className="absolute right-2 top-2 h-7 w-7 p-0 transition-all"
          >
            {disabled ? (
              <Clock className="w-3 h-3" />
            ) : copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CLIInstaller() {
  const [selectedMode, setSelectedMode] = useState<CLIInstallMode>("npx");
  const [copied, setCopied] = useState(false);

  const installModes: {
    value: CLIInstallMode;
    label: string;
    command: string;
  }[] = [
    { value: "npx", label: "npx", command: "npx lerobot@latest" },
    { value: "npm", label: "npm", command: "npm install -g lerobot" },
  ];

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const currentCommand =
    installModes.find((mode) => mode.value === selectedMode)?.command || "";

  return (
    <div className="max-w-md">
      <div className="space-y-3">
        <div className="flex gap-1 w-fit">
          {installModes.map((mode) => (
            <Button
              key={mode.value}
              variant="ghost"
              size="sm"
              onClick={() => setSelectedMode(mode.value)}
              className={cn(
                "font-mono text-xs px-3 min-w-[60px] h-8 border transition-colors",
                selectedMode === mode.value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent border-input hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {mode.label}
            </Button>
          ))}
        </div>

        <div className="relative">
          <div className="border rounded-md p-3 font-mono text-sm bg-muted/60 dark:bg-black/40 border-border dark:border-white/10 text-foreground dark:text-primary">
            {currentCommand}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyToClipboard(currentCommand)}
            className="absolute right-2 top-2 h-7 w-7 p-0 transition-all"
          >
            {copied ? (
              <Check className="w-3 h-3" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SetupCards() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Web Installation Card */}
      {/* HudCorners creates 4 absolutely positioned corner elements with primary color borders */}
      <HudCorners color="primary" size="sm" layer="front">
        <Card className="h-full border-dashed border border-muted/30 relative">
          {/* GitHub Link */}
          <a
            href="https://github.com/timpietrusky/lerobot.js/tree/main/packages/web"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-6 right-6 p-2 rounded-lg hover:bg-primary/10 transition-colors group"
            title="View @lerobot/web on GitHub"
          >
            <Github className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          {/* This div contains the card content and sits above the corner elements due to relative positioning */}
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary font-mono tracking-wider uppercase">
                  web
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  run LeRobot.js in the browser
                </p>
              </div>
            </div>

            <PackageInstaller packageName="@lerobot/web" />
          </div>
        </Card>
      </HudCorners>

      {/* Node.js Card - Active */}
      <HudCorners color="primary" size="sm" layer="front">
        <Card className="h-full border-dashed border border-muted/30 relative">
          {/* GitHub Link */}
          <a
            href="https://github.com/timpietrusky/lerobot.js/tree/main/packages/node"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-6 right-6 p-2 rounded-lg hover:bg-primary/10 transition-colors group"
            title="View @lerobot/node on GitHub"
          >
            <Github className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary font-mono tracking-wider uppercase">
                  node
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  run LeRobot.js on the server
                </p>
              </div>
            </div>

            <PackageInstaller packageName="@lerobot/node" />
          </div>
        </Card>
      </HudCorners>

      {/* CLI Card - Active */}
      <HudCorners color="primary" size="sm" layer="front">
        <Card className="h-full border-dashed border border-muted/30 relative">
          {/* GitHub Link */}
          <a
            href="https://github.com/timpietrusky/lerobot.js/tree/main/packages/cli"
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-6 right-6 p-2 rounded-lg hover:bg-primary/10 transition-colors group"
            title="View lerobot CLI on GitHub"
          >
            <Github className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                <Terminal className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-primary font-mono tracking-wider uppercase">
                  CLI
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  run LeRobot.js in the CLI
                </p>
              </div>
            </div>

            <CLIInstaller />
          </div>
        </Card>
      </HudCorners>
    </div>
  );
}

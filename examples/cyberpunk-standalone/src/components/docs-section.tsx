"use client"

import type React from "react"
import { Book, Code2, Terminal, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const CodeBlock = ({ children }: { children: React.ReactNode }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const codeText = typeof children === "string" ? children : children?.toString() || ""

  return (
    <div className="bg-muted/50 dark:bg-black/40 border border-border dark:border-white/10 rounded-md overflow-hidden my-4 relative">
      <pre className="p-4 text-sm overflow-x-auto">
        <code>{children}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyToClipboard(codeText)}
        className="absolute top-2 right-2 h-7 w-7 p-0 transition-all"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  )
}

export function DocsSection() {
  return (
    <div className="font-mono">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary tracking-wider mb-2 uppercase flex items-center gap-3">
          <Book className="w-6 h-6" />
          Docs
        </h2>
        <p className="text-sm text-muted-foreground">A quick guide to get started with the @lerobot/web API.</p>
      </div>

      <div className="bg-muted/40 dark:bg-black/30 border-l-4 border-cyan-500 dark:border-accent-cyan p-6 md:p-8 rounded-r-lg space-y-8">
        {/* Getting Started */}
        <div>
          <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Getting Started
          </h3>
          <p className="text-muted-foreground text-sm mt-2 mb-4">
            First, import the API from the library. Then you can call its methods to find and control your robot.
          </p>
          <CodeBlock>
            {`import { lerobot } from '@lerobot/web';

async function connectToRobot() {
  const { result } = await lerobot.findPort({
    onMessage: (message) => console.log('Status:', message),
  });
  
  const robots = await result;
  console.log('Found robots:', robots);
}`}
          </CodeBlock>
        </div>

        {/* API Reference */}
        <div>
          <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            API Reference
          </h3>
          <div className="space-y-6 mt-4">
            {/* findPort */}
            <div>
              <h4 className="font-bold text-primary">lerobot.findPort(options)</h4>
              <p className="text-muted-foreground text-sm mt-1">Scans for available robot connections via WebSerial.</p>
              <CodeBlock>
                {`// Options
{
  robotConfigs?: RobotConfig[], // Optional: Saved configs to try reconnecting
  onMessage?: (msg: string) => void // Callback for status updates
}

// Returns
{
  result: Promise<RobotConnection[]> // A promise that resolves with found robots
}`}
              </CodeBlock>
            </div>

            {/* calibrate */}
            <div>
              <h4 className="font-bold text-primary">lerobot.calibrate(robot, options)</h4>
              <p className="text-muted-foreground text-sm mt-1">Starts the calibration process for a specific robot.</p>
              <CodeBlock>
                {`// Parameters
robot: RobotConnection // The robot instance to calibrate

// Options
{
  onLiveUpdate: (data: LiveCalibrationData) => void, // Callback for real-time joint data
  onProgress: (msg: string) => void // Callback for status messages
}

// Returns
{
  result: Promise<WebCalibrationResults>, // A promise that resolves with final calibration
  stop: () => void // Function to stop the calibration recording
}`}
              </CodeBlock>
            </div>

            {/* teleoperate */}
            <div>
              <h4 className="font-bold text-primary">lerobot.teleoperate(robot, options)</h4>
              <p className="text-muted-foreground text-sm mt-1">Initializes the teleoperation interface for a robot.</p>
              <CodeBlock>
                {`// Parameters
robot: RobotConnection,
calibrationData: WebCalibrationResults

// Options
{
  onStateUpdate: (state: TeleoperationState) => void // Callback for real-time state updates
}

// Returns
{
  start: () => void,
  stop: () => void,
  updateKeyState: (key: string, pressed: boolean) => void,
  moveMotor: (motorName: string, position: number) => void
}`}
              </CodeBlock>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

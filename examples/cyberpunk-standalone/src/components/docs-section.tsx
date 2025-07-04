"use client";

import type React from "react";
import { Book, Code2, Terminal, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const CodeBlock = ({
  children,
  language = "typescript",
}: {
  children: React.ReactNode;
  language?: string;
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const codeText =
    typeof children === "string" ? children : children?.toString() || "";

  return (
    <div className="bg-slate-800 dark:bg-black/40 border border-border dark:border-white/10 rounded-md overflow-hidden my-4 relative">
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: "1rem",
          fontSize: "0.875rem",
          background: "transparent",
          backgroundColor: "transparent",
          fontFamily:
            "Geist Mono, ui-monospace, SFMono-Regular, 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
        }}
        wrapLines={true}
        wrapLongLines={true}
        codeTagProps={{
          style: {
            background: "transparent",
            backgroundColor: "transparent",
          },
        }}
      >
        {codeText}
      </SyntaxHighlighter>
      <Button
        variant="outline"
        size="sm"
        onClick={() => copyToClipboard(codeText)}
        className="absolute top-2 right-2 h-7 w-7 p-0 transition-all"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      </Button>
    </div>
  );
};

export function DocsSection() {
  return (
    <div className="font-mono">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-wider mb-2 uppercase flex items-center gap-3">
          <Book className="w-6 h-6" />
          Docs
        </h2>
        <p className="text-sm text-muted-foreground">
          Complete API reference for @lerobot/web
        </p>
      </div>

      <div className="bg-muted/40 dark:bg-black/30 border border-border dark:border-white/10 p-6 md:p-8 rounded-lg space-y-14">
        {/* Browser Requirements */}
        <div>
          <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase">
            Browser Requirements
          </h3>
          <div className="mt-4 space-y-2 text-sm">
            <div>
              • <strong>Chromium 89+</strong> with WebSerial and WebUSB API
              support
            </div>
            <div>
              • <strong>HTTPS or localhost</strong>
            </div>
            <div>
              • <strong>User gesture</strong> required for initial port
              selection
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div>
          <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            Getting Started
          </h3>
          <p className="text-muted-foreground text-sm mt-2 mb-4">
            Complete workflow from discovery to teleoperation.
          </p>
          <CodeBlock>
            {`import { findPort, releaseMotors, calibrate, teleoperate } from "@lerobot/web";

// 1. find and connect to hardware like a robot arm
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = robots[0];

// 2. release the motors and put them into the homing position
await releaseMotors(robot);

// 3. calibrate the motors by moving each motor through its full range of motion
const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => console.log(message),
  onLiveUpdate: (data) => console.log("Live positions:", data),
});

// when done, stop calibration and get the min/max ranges for each motor
calibrationProcess.stop();
const calibrationData = await calibrationProcess.result;

// 4. start controlling the robot arm with your keyboard
const teleop = await teleoperate({
  robot,
  calibrationData,
  teleop: { type: "keyboard" },
});
teleop.start();

// 5. stop control (run this when you're done)
teleop.stop();`}
          </CodeBlock>
        </div>

        {/* API Reference */}
        <div>
          <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
            <Code2 className="w-5 h-5" />
            API Reference
          </h3>
          <div className="space-y-12 mt-4">
            {/* findPort */}
            <div>
              <h4 className="font-bold text-primary">findPort(config?)</h4>
              <p className="text-muted-foreground text-sm mt-1">
                Discovers and connects to robotics hardware using WebSerial API.
              </p>
              <CodeBlock>
                {`// Interactive Mode (Default) - Shows port dialog
const findProcess = await findPort();
const robots = await findProcess.result; // RobotConnection[]

// Auto-Connect Mode - Reconnects to known robots
const findProcess = await findPort({
  robotConfigs: [
    { robotType: "so100_follower", robotId: "left_arm", serialNumber: "USB123" }
  ],
  onMessage: (msg) => console.log(msg),
});`}
              </CodeBlock>
              <div className="mt-3">
                <h5 className="font-bold text-sm text-muted-foreground tracking-wider">
                  Options
                </h5>
                <ul className="mt-1 ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • <code>robotConfigs?: RobotConfig[]</code> - Auto-connect
                    to these known robots
                  </li>
                  <li>
                    • <code>onMessage?: (message: string) =&gt; void</code> -
                    Progress messages callback
                  </li>
                </ul>
              </div>
              <div className="mt-3">
                <h5 className="font-bold text-sm text-muted-foreground tracking-wider">
                  Returns:{" "}
                  <code className="bg-muted/50 px-1 rounded">
                    FindPortProcess
                  </code>
                </h5>
                <ul className="mt-1 ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • <code>result: Promise&lt;RobotConnection[]&gt;</code> -
                    Array of robot connections
                  </li>
                  <li>
                    • <code>stop(): void</code> - Cancel discovery process
                  </li>
                </ul>
              </div>
            </div>

            {/* calibrate */}
            <div>
              <h4 className="font-bold text-primary">calibrate(config)</h4>
              <p className="text-muted-foreground text-sm mt-1">
                Calibrates motor homing offsets and records range of motion.
              </p>
              <CodeBlock>
                {`const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => {
    console.log(message); // "⚙️ Setting motor homing offsets"
  },
  onLiveUpdate: (data) => {
    // Real-time motor positions during range recording
    Object.entries(data).forEach(([motor, info]) => {
      console.log(\`\${motor}: \${info.current} (range: \${info.range})\`);
    });
  },
});

// Move robot through full range of motion...
calibrationProcess.stop(); // Stop range recording
const calibrationData = await calibrationProcess.result;`}
              </CodeBlock>
              <div className="mt-3">
                <h5 className="font-bold text-sm text-muted-foreground tracking-wider">
                  Returns:{" "}
                  <code className="bg-muted/50 px-1 rounded">
                    CalibrationProcess
                  </code>
                </h5>
                <ul className="mt-1 ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • <code>result: Promise&lt;WebCalibrationResults&gt;</code>{" "}
                    - Python-compatible format
                  </li>
                  <li>
                    • <code>stop(): void</code> - Stop calibration process
                  </li>
                </ul>
              </div>
            </div>

            {/* teleoperate */}
            <div>
              <h4 className="font-bold text-primary">teleoperate(config)</h4>
              <p className="text-muted-foreground text-sm mt-1">
                Enables real-time robot control with extensible input devices.
              </p>
              <CodeBlock>
                {`// Keyboard Teleoperation
const keyboardTeleop = await teleoperate({
  robot,
  calibrationData: savedCalibrationData,
  teleop: { type: "keyboard" },
  onStateUpdate: (state) => {
    console.log(\`Active: \${state.isActive}\`);
    console.log(\`Motors:\`, state.motorConfigs);
  },
});

// Direct Teleoperation
const directTeleop = await teleoperate({
  robot,
  calibrationData: savedCalibrationData,
  teleop: { type: "direct" },
});`}
              </CodeBlock>
              <div className="mt-3">
                <h5 className="font-bold text-sm text-muted-foreground tracking-wider">
                  Returns:{" "}
                  <code className="bg-muted/50 px-1 rounded">
                    TeleoperationProcess
                  </code>
                </h5>
                <ul className="mt-1 ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • <code>start(): void</code> - Begin teleoperation
                  </li>
                  <li>
                    • <code>stop(): void</code> - Stop teleoperation and clear
                    states
                  </li>
                  <li>
                    • <code>getState(): TeleoperationState</code> - Current
                    state and motor positions
                  </li>
                  <li>
                    • <code>teleoperator: BaseWebTeleoperator</code> - Access
                    teleoperator-specific methods
                  </li>
                  <li>
                    • <code>disconnect(): Promise&lt;void&gt;</code> - Stop and
                    disconnect
                  </li>
                </ul>
              </div>
            </div>

            {/* releaseMotors */}
            <div>
              <h4 className="font-bold text-primary">
                releaseMotors(robot, motorIds?)
              </h4>
              <p className="text-muted-foreground text-sm mt-1">
                Releases motor torque so robot can be moved freely by hand.
              </p>
              <CodeBlock>
                {`// Release all motors for calibration
await releaseMotors(robot);

// Release specific motors only
await releaseMotors(robot, [1, 2, 3]);`}
              </CodeBlock>
              <div className="mt-3">
                <h5 className="font-bold text-sm text-muted-foreground tracking-wider">
                  Parameters
                </h5>
                <ul className="mt-1 ml-4 space-y-1 text-sm text-muted-foreground">
                  <li>
                    • <code>robot: RobotConnection</code> - Connected robot
                  </li>
                  <li>
                    • <code>motorIds?: number[]</code> - Specific motor IDs
                    (default: all motors for robot type)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

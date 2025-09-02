"use client";

import type React from "react";
import {
  Book,
  Code2,
  Terminal,
  Copy,
  Check,
  Monitor,
  Server,
  Command,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, createContext, useContext } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

type CLIMode = "npm" | "npx";

const CLIModeContext = createContext<{
  mode: CLIMode;
  setMode: (mode: CLIMode) => void;
}>({
  mode: "npx",
  setMode: () => {},
});

const CLIModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setMode] = useState<CLIMode>("npx");
  return (
    <CLIModeContext.Provider value={{ mode, setMode }}>
      {children}
    </CLIModeContext.Provider>
  );
};

const CLIModeSwitch = ({ className = "" }: { className?: string }) => {
  const { mode, setMode } = useContext(CLIModeContext);

  return (
    <div className={`flex gap-1 w-fit ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode("npx")}
        className={`font-mono text-xs px-3 min-w-[60px] h-8 border transition-colors ${
          mode === "npx"
            ? "bg-foreground text-background border-foreground"
            : "bg-transparent border-input hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        npx
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode("npm")}
        className={`font-mono text-xs px-3 min-w-[60px] h-8 border transition-colors ${
          mode === "npm"
            ? "bg-foreground text-background border-foreground"
            : "bg-transparent border-input hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        npm
      </Button>
    </div>
  );
};

const CLICodeBlock = ({
  children,
  language = "bash",
}: {
  children: React.ReactNode;
  language?: string;
}) => {
  const { mode } = useContext(CLIModeContext);
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

  // Convert commands based on mode
  const convertCommands = (text: string) => {
    if (mode === "npx") {
      return text
        .replace(/^lerobot /gm, "npx lerobot@latest ")
        .replace(/# lerobot /gm, "# npx lerobot@latest ");
    }
    return text;
  };

  const codeText =
    typeof children === "string" ? children : children?.toString() || "";
  const convertedCode = convertCommands(codeText);

  return (
    <div className="my-4">
      <div className="flex items-center justify-between mb-2">
        <CLIModeSwitch />
      </div>
      <div className="bg-slate-800 dark:bg-black/40 border border-border dark:border-white/10 rounded-md overflow-hidden relative">
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
          {convertedCode}
        </SyntaxHighlighter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => copyToClipboard(convertedCode)}
          className="absolute top-2 right-2 h-7 w-7 p-0 transition-all"
        >
          {copied ? (
            <Check className="w-3 h-3" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </Button>
      </div>
    </div>
  );
};

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
          Complete API reference for all lerobot.js packages
        </p>
      </div>

      <div className="bg-muted/40 dark:bg-black/30 border border-border dark:border-white/10 p-6 md:p-8 rounded-lg">
        <Tabs defaultValue="web" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 h-auto p-2">
            <TabsTrigger
              value="web"
              className="flex items-center gap-3 h-16 px-4 data-[state=active]:bg-background"
            >
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm uppercase tracking-wider">
                  WEB
                </div>
                <div className="text-xs text-muted-foreground">
                  @lerobot/web
                </div>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="node"
              className="flex items-center gap-3 h-16 px-4 data-[state=active]:bg-background"
            >
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Server className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm uppercase tracking-wider">
                  NODE
                </div>
                <div className="text-xs text-muted-foreground">
                  @lerobot/node
                </div>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="cli"
              className="flex items-center gap-3 h-16 px-4 data-[state=active]:bg-background"
            >
              <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                <Terminal className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-bold text-sm uppercase tracking-wider">
                  CLI
                </div>
                <div className="text-xs text-muted-foreground">lerobot</div>
              </div>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="web" className="space-y-14">
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

            {/* Quick Start */}
            <div>
              <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Quick Start
              </h3>
              <p className="text-sm mt-2 mb-4">
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
                  <p className="text-sm mt-1">
                    Discovers and connects to robotics hardware using WebSerial
                    API.
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
                    <h5 className="font-bold text-sm tracking-wider">
                      Options
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>robotConfigs?: RobotConfig[]</code> -
                        Auto-connect to these known robots
                      </li>
                      <li>
                        • <code>onMessage?: (message: string) =&gt; void</code>{" "}
                        - Progress messages callback
                      </li>
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Returns:{" "}
                      <code className="bg-muted/50 px-1 rounded">
                        FindPortProcess
                      </code>
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>result: Promise&lt;RobotConnection[]&gt;</code>{" "}
                        - Array of robot connections
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
                  <p className="text-sm mt-1">
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
                    <h5 className="font-bold text-sm tracking-wider">
                      Options
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>robot: RobotConnection</code> - Connected robot
                        from findPort()
                      </li>
                      <li>
                        • <code>onProgress?: (message: string) =&gt; void</code>{" "}
                        - Progress messages callback
                      </li>
                      <li>
                        •{" "}
                        <code>
                          onLiveUpdate?: (data: LiveCalibrationData) =&gt; void
                        </code>{" "}
                        - Real-time position updates
                      </li>
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Returns:{" "}
                      <code className="bg-muted/50 px-1 rounded">
                        CalibrationProcess
                      </code>
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>result: Promise&lt;CalibrationResults&gt;</code>{" "}
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
                  <h4 className="font-bold text-primary">
                    teleoperate(config)
                  </h4>
                  <p className="text-sm mt-1">
                    Enables real-time robot control with extensible input
                    devices.
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
                    <h5 className="font-bold text-sm tracking-wider">
                      Options
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>robot: RobotConnection</code> - Connected robot
                        from findPort()
                      </li>
                      <li>
                        • <code>teleop: TeleoperatorConfig</code> - Teleoperator
                        configuration:
                        <ul className="mt-1 ml-4 space-y-1">
                          <li>
                            • <code>{`{ type: "keyboard" }`}</code> - Keyboard
                            control
                          </li>
                          <li>
                            • <code>{`{ type: "direct" }`}</code> - Direct
                            programmatic control
                          </li>
                        </ul>
                      </li>
                      <li>
                        •{" "}
                        <code>
                          calibrationData?: {`{ [motorName: string]: any }`}
                        </code>{" "}
                        - Calibration data from calibrate()
                      </li>
                      <li>
                        •{" "}
                        <code>
                          onStateUpdate?: (state: TeleoperationState) =&gt; void
                        </code>{" "}
                        - State change callback
                      </li>
                    </ul>
                  </div>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Returns:{" "}
                      <code className="bg-muted/50 px-1 rounded">
                        TeleoperationProcess
                      </code>
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>start(): void</code> - Begin teleoperation
                      </li>
                      <li>
                        • <code>stop(): void</code> - Stop teleoperation and
                        clear states
                      </li>
                      <li>
                        • <code>getState(): TeleoperationState</code> - Current
                        state and motor positions
                      </li>
                      <li>
                        • <code>teleoperator: BaseWebTeleoperator</code> -
                        Access teleoperator-specific methods
                      </li>
                      <li>
                        • <code>disconnect(): Promise&lt;void&gt;</code> - Stop
                        and disconnect
                      </li>
                    </ul>
                  </div>
                </div>

                {/* releaseMotors */}
                <div>
                  <h4 className="font-bold text-primary">
                    releaseMotors(robot, motorIds?)
                  </h4>
                  <p className="text-sm mt-1">
                    Releases motor torque so robot can be moved freely by hand.
                  </p>
                  <CodeBlock>
                    {`// Release all motors for calibration
await releaseMotors(robot);

// Release specific motors only
await releaseMotors(robot, [1, 2, 3]);`}
                  </CodeBlock>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Options
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
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
          </TabsContent>

          <TabsContent value="node" className="space-y-14">
            {/* Node.js Requirements */}
            <div>
              <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase">
                Node.js Requirements
              </h3>
              <div className="mt-4 space-y-2 text-sm">
                <div>
                  • <strong>Node.js 18+</strong> (Windows, macOS, Linux)
                </div>
                <div>
                  • <strong>Serial port access</strong> (may require
                  permissions)
                </div>
                <div>
                  • <strong>SO-100 robot hardware</strong> with USB connection
                </div>
              </div>
            </div>

            {/* Quick Start */}
            <div>
              <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                Quick Start
              </h3>
              <p className="text-sm mt-2 mb-4">
                Complete workflow from discovery to teleoperation in Node.js.
              </p>
              <CodeBlock>
                {`import { findPort, connectPort, releaseMotors, calibrate, teleoperate } from "@lerobot/node";

// 1. find available robot ports
console.log("🔍 finding available robot ports...");
const findProcess = await findPort();
const robots = await findProcess.result;

if (robots.length === 0) {
  console.log("❌ no robots found. check connections.");
  process.exit(1);
}

// 2. connect to the first robot found
console.log(\`✅ found \${robots.length} robot(s). connecting to first one...\`);
const robot = await connectPort(robots[0].path, robots[0].robotType);

// 3. release motors for manual positioning
console.log("🔓 releasing motors for manual positioning...");
await releaseMotors(robot);

// 4. calibrate motors by moving through full range
console.log("⚙️ starting calibration...");
const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => console.log(message),
  onLiveUpdate: (data) => console.log("live positions:", data),
});

// move robot through its range, then stop calibration
console.log("👋 move robot through full range, press enter when done...");
process.stdin.once("data", () => {
  calibrationProcess.stop();
});

const calibrationData = await calibrationProcess.result;
console.log("✅ calibration complete!");

// 5. control robot with keyboard
console.log("🎮 starting keyboard control...");
const teleop = await teleoperate({
  robot,
  calibrationData,
  teleop: { type: "keyboard" },
});
teleop.start();`}
              </CodeBlock>
            </div>

            {/* How It Works */}
            <div>
              <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase">
                How It Works
              </h3>
              <div className="mt-4 space-y-6">
                <div>
                  <h4 className="font-bold text-primary">
                    Beginner Flow: findPort() → connectPort() → Use Robot
                  </h4>
                  <p className="text-sm mt-1 mb-3">
                    Most users should start with findPort() for discovery, then
                    connectPort() for connection:
                  </p>
                  <CodeBlock>
                    {`// ✅ recommended: discover then connect
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = await connectPort(robots[0].path, robots[0].robotType);`}
                  </CodeBlock>
                </div>
                <div>
                  <h4 className="font-bold text-primary">
                    Advanced: Direct Connection with connectPort()
                  </h4>
                  <p className="text-sm mt-1 mb-3">
                    Only use connectPort() when you already know the exact port:
                  </p>
                  <CodeBlock>
                    {`// ⚡ advanced: direct connection to known port
const robot = await connectPort("/dev/ttyUSB0", "so100_follower");`}
                  </CodeBlock>
                </div>
              </div>
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
                  <p className="text-sm mt-1">
                    Discovers available robotics hardware on serial ports.
                    Unlike the web version, this only discovers ports -
                    connection happens separately with connectPort().
                  </p>
                  <CodeBlock>
                    {`// Discover all available robots
const findProcess = await findPort();
const robots = await findProcess.result;

console.log(\`Found \${robots.length} robot(s):\`);
robots.forEach((robot) => {
  console.log(\`- \${robot.robotType} on \${robot.path}\`);
});

// Connect to specific robot
const robot = await connectPort(robots[0].path, robots[0].robotType);`}
                  </CodeBlock>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Returns: FindPortProcess
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>result: Promise&lt;DiscoveredRobot[]&gt;</code>{" "}
                        - Array of discovered robots with path, robotType, and
                        other metadata
                      </li>
                      <li>
                        • <code>stop(): void</code> - Cancel discovery process
                      </li>
                    </ul>
                  </div>
                </div>

                {/* connectPort */}
                <div>
                  <h4 className="font-bold text-primary">
                    connectPort(port, robotType, robotId?)
                  </h4>
                  <p className="text-sm mt-1">
                    Creates a connection to a robot on the specified serial
                    port.
                  </p>
                  <CodeBlock>
                    {`// Connect to SO-100 follower arm
const robot = await connectPort(
  "/dev/ttyUSB0",     // Serial port path
  "so100_follower",   // Robot type
  "my_robot_arm"      // Custom robot ID
);

// Windows
const robot = await connectPort("COM4", "so100_follower", "my_robot");

// Connection is ready to use
console.log(\`Connected to \${robot.robotType} on \${robot.port.path}\`);`}
                  </CodeBlock>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Parameters
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>port: string</code> - Serial port path (e.g.,
                        /dev/ttyUSB0, COM4)
                      </li>
                      <li>
                        •{" "}
                        <code>
                          robotType: "so100_follower" | "so100_leader"
                        </code>{" "}
                        - Type of robot
                      </li>
                      <li>
                        • <code>robotId?: string</code> - Custom identifier for
                        your robot
                      </li>
                    </ul>
                  </div>
                </div>

                {/* calibrate */}
                <div>
                  <h4 className="font-bold text-primary">calibrate(config)</h4>
                  <p className="text-sm mt-1">
                    Calibrates motor homing offsets and records range of motion.{" "}
                    <strong>Identical to Python lerobot behavior.</strong>
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
// When finished, stop calibration
calibrationProcess.stop();

const calibrationData = await calibrationProcess.result;

// Save to file (Python-compatible format)
import { writeFileSync } from "fs";
writeFileSync(
  "./my_robot_calibration.json",
  JSON.stringify(calibrationData, null, 2)
);`}
                  </CodeBlock>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Returns: CalibrationProcess
                    </h5>
                    <ul className="mt-1 ml-4 space-y-1 text-sm">
                      <li>
                        • <code>result: Promise&lt;CalibrationResults&gt;</code>{" "}
                        - <strong>Python-compatible</strong> calibration data
                      </li>
                      <li>
                        • <code>stop(): void</code> - Stop calibration process
                      </li>
                    </ul>
                  </div>
                </div>

                {/* teleoperate */}
                <div>
                  <h4 className="font-bold text-primary">
                    teleoperate(config)
                  </h4>
                  <p className="text-sm mt-1">
                    Real-time robot control with keyboard input.{" "}
                    <strong>Smooth, responsive movement</strong> optimized for
                    Node.js.
                  </p>
                  <CodeBlock>
                    {`const teleop = await teleoperate({
  robot,
  teleop: { type: "keyboard" },
  onStateUpdate: (state) => {
    console.log(\`Active: \${state.isActive}\`);
    state.motorConfigs.forEach((motor) => {
      console.log(\`\${motor.name}: \${motor.currentPosition}\`);
    });
  },
});

// Start keyboard control
teleop.start();

// Control will be active until stopped
setTimeout(() => teleop.stop(), 60000);`}
                  </CodeBlock>
                  <div className="mt-3">
                    <h5 className="font-bold text-sm tracking-wider">
                      Keyboard Controls (SO-100)
                    </h5>
                    <div className="mt-1 ml-4 text-sm font-mono">
                      <div>Arrow Keys: Shoulder pan/lift</div>
                      <div>WASD: Elbow flex, wrist flex</div>
                      <div>Q/E: Wrist roll</div>
                      <div>O/C: Gripper open/close</div>
                      <div>ESC: Emergency stop</div>
                      <div>Ctrl+C: Exit</div>
                    </div>
                  </div>
                </div>

                {/* releaseMotors */}
                <div>
                  <h4 className="font-bold text-primary">
                    releaseMotors(robot)
                  </h4>
                  <p className="text-sm mt-1">
                    Releases motor torque so robot can be moved freely by hand.
                  </p>
                  <CodeBlock>
                    {`// Release all motors for calibration
await releaseMotors(robot);
console.log("Motors released - you can now move the robot freely");`}
                  </CodeBlock>
                </div>
              </div>
            </div>

            {/* Serial Port Permissions */}
            <div>
              <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase">
                Serial Port Permissions
              </h3>
              <div className="mt-4 space-y-4">
                <div>
                  <h4 className="font-bold text-primary">Linux/macOS</h4>
                  <CodeBlock language="bash">
                    {`# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER

# Set permissions (macOS)
sudo chmod 666 /dev/tty.usbserial-*`}
                  </CodeBlock>
                </div>
                <div>
                  <h4 className="font-bold text-primary">Windows</h4>
                  <p className="text-sm">No additional setup required.</p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cli" className="space-y-14">
            <CLIModeProvider>
              {/* Commands */}
              <div>
                <h3 className="text-xl font-bold text-cyan-600 dark:text-accent-cyan tracking-wider uppercase flex items-center gap-2">
                  <Code2 className="w-5 h-5" />
                  Available Commands
                </h3>
                <div className="space-y-8 mt-4">
                  {/* find-port */}
                  <div>
                    <h4 className="font-bold text-primary">find-port</h4>
                    <p className="text-sm mt-1">
                      Interactive port discovery using cable detection.
                    </p>
                    <CLICodeBlock language="bash">
                      {`lerobot find-port

# Interactive process:
# 1. Lists current ports
# 2. Prompts to unplug USB cable  
# 3. Detects which port disappeared
# 4. Prompts to reconnect cable`}
                    </CLICodeBlock>
                  </div>

                  {/* calibrate */}
                  <div>
                    <h4 className="font-bold text-primary">calibrate</h4>
                    <p className="text-sm mt-1">
                      Calibrate robot motors and save calibration data.
                    </p>
                    <CLICodeBlock language="bash">
                      {`lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm

# Options:
# --robot.type    Robot type (so100_follower, so100_leader)
# --robot.port    Serial port (/dev/ttyUSB0, COM4)
# --robot.id      Robot identifier (default: "default")
# --output        Custom output path for calibration file`}
                    </CLICodeBlock>
                  </div>

                  {/* teleoperate */}
                  <div>
                    <h4 className="font-bold text-primary">teleoperate</h4>
                    <p className="text-sm mt-1">
                      Control robot through keyboard input.
                    </p>
                    <CLICodeBlock language="bash">
                      {`lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0 --robot.id=my_arm

# Keyboard Controls:
# w/s          - Elbow flex/extend
# a/d          - Wrist down/up  
# q/e          - Wrist roll left/right
# o/c          - Gripper open/close
# Arrow keys   - Shoulder lift/pan
# Ctrl+C       - Stop and exit`}
                    </CLICodeBlock>
                  </div>
                </div>
              </div>
            </CLIModeProvider>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

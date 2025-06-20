# User Story 004: Keyboard Teleoperation

## Story

**As a** robotics developer using SO-100 robot arms for testing and demonstrations  
**I want** to control my robot arm using keyboard keys in real-time  
**So that** I can manually operate the robot, test its movements, and demonstrate its capabilities without needing a second robot arm

## Background

Keyboard teleoperation provides an immediate way to control robot arms for testing, demonstration, and manual operation. While the Python lerobot focuses primarily on leader-follower teleoperation, keyboard control is an essential feature for:

- **Quick Testing**: Verify robot functionality and range of motion
- **Demonstrations**: Show robot capabilities without complex setup
- **Development**: Test robot behavior during development
- **Troubleshooting**: Manually position robot for debugging
- **Accessibility**: Control robots without specialized hardware

The Python lerobot includes keyboard teleoperation capabilities within its teleoperator framework. We need to implement this as a standalone feature in lerobot.js, reusing our existing robot connection and calibration infrastructure from User Story 002.

This will be a "quick win" implementation that:

1. Reuses existing SO-100 robot connection logic
2. Adds keyboard input handling (Node.js terminal + Web browser)
3. Provides real-time motor control within calibrated ranges
4. Shows live position feedback and performance metrics

## Acceptance Criteria

### Core Functionality

- [ ] **Single Robot Control**: Connect to one SO-100 follower robot
- [ ] **Keyboard Input**: Arrow keys, WASD, and other keys control robot motors
- [ ] **Real-time Control**: Immediate response to keyboard input
- [ ] **Position Limits**: Respect calibrated min/max ranges from calibration data
- [ ] **Live Feedback**: Display current motor positions in real-time
- [ ] **Graceful Shutdown**: Clean disconnection on ESC or Ctrl+C
- [ ] **Cross-Platform**: Work on Windows, macOS, and Linux
- [ ] **CLI Interface**: Provide `npx lerobot teleoperate` command

### User Experience

- [ ] **Clear Controls**: Display control instructions (which keys do what)
- [ ] **Live Position Display**: Real-time motor position values
- [ ] **Performance Feedback**: Show control loop timing and responsiveness
- [ ] **Error Handling**: Handle connection failures and invalid movements gracefully
- [ ] **Emergency Stop**: ESC key immediately stops all movement
- [ ] **Smooth Control**: Responsive and intuitive robot movement

### Technical Requirements

- [ ] **Dual Platform**: Support both Node.js (CLI) and Web (browser) platforms
- [ ] **Existing Robot Reuse**: Use existing SO-100 robot connection logic from calibration
- [ ] **TypeScript**: Fully typed implementation following project conventions
- [ ] **Configuration Integration**: Load and use calibration data for position limits
- [ ] **Platform-Appropriate Input**: Terminal keyboard (Node.js) vs browser keyboard (Web)

## Expected User Flow

### Node.js CLI Keyboard Teleoperation

```bash
# Simple keyboard control
$ npx lerobot teleoperate \
    --robot.type=so100_follower \
    --robot.port=COM4 \
    --robot.id=my_follower_arm \
    --teleop.type=keyboard

Connecting to robot: so100_follower on COM4
Robot connected successfully.
Loading calibration: my_follower_arm

Starting keyboard teleoperation...
Controls:
  ↑↓ Arrow Keys: Shoulder Lift
  ←→ Arrow Keys: Shoulder Pan
  W/S: Elbow Flex
  A/D: Wrist Flex
  Q/E: Wrist Roll
  Space: Gripper Toggle
  ESC: Emergency Stop
  Ctrl+C: Exit

Press any control key to begin...

Current Positions:
shoulder_pan: 2047 (range: 985-3085)
shoulder_lift: 2047 (range: 1200-2800)
elbow_flex: 2047 (range: 1000-3000)
wrist_flex: 2047 (range: 1100-2900)
wrist_roll: 2047 (range: 0-4095)
gripper: 2047 (range: 1800-2300)

Loop: 16.67ms (60 Hz) | Status: Connected
```

### Web Browser Keyboard Teleoperation

```typescript
// In a web application
import { teleoperate } from "lerobot/web/teleoperate";

// Must be triggered by user interaction
await teleoperate({
  robot: {
    type: "so100_follower",
    id: "my_follower_arm",
    // port selected via browser dialog
  },
  teleop: {
    type: "keyboard",
  },
});

// Browser shows modern teleoperation interface with:
// - Live robot arm position visualization
// - On-screen keyboard control instructions
// - Real-time position values and ranges
// - Emergency stop button
// - Performance metrics
```

### Advanced Usage

```bash
# With custom control settings
$ npx lerobot teleoperate \
    --robot.type=so100_follower \
    --robot.port=COM4 \
    --robot.id=my_follower_arm \
    --teleop.type=keyboard \
    --step_size=50 \
    --fps=30

# Different step sizes for finer/coarser control
# Custom frame rates for different performance needs
```

## Implementation Details

### File Structure

```
src/lerobot/
├── node/
│   ├── teleoperate.ts              # Node.js keyboard teleoperation
│   ├── keyboard_teleop.ts          # Node.js keyboard input handling
│   └── robots/
│       └── so100_follower.ts       # Extend existing robot for teleoperation
└── web/
    ├── teleoperate.ts              # Web keyboard teleoperation
    ├── keyboard_teleop.ts          # Web keyboard input handling
    └── robots/
        └── so100_follower.ts       # Extend existing robot for teleoperation

src/demo/
├── components/
│   ├── KeyboardTeleopInterface.tsx # Keyboard teleoperation interface
│   ├── RobotPositionDisplay.tsx    # Live position visualization
│   ├── ControlInstructions.tsx     # Keyboard control help
│   └── PerformanceMonitor.tsx      # Loop timing and metrics
└── pages/
    └── KeyboardTeleop.tsx          # Keyboard teleoperation demo page

src/cli/
└── index.ts                        # CLI entry point (Node.js only)
```

### Key Dependencies

#### Node.js Platform

- **keypress**: For raw keyboard input in terminal
- **chalk**: For colored terminal output and status display
- **Existing robot classes**: Reuse SO-100 connection logic from calibration

#### Web Platform

- **KeyboardEvent API**: Built-in browser keyboard handling
- **Existing robot classes**: Reuse SO-100 connection logic from calibration
- **React**: For demo interface components

### Core Functions to Implement

#### Simplified Interface

```typescript
// teleoperate.ts (simplified for keyboard-only)
interface TeleoperateConfig {
  robot: RobotConfig; // Reuse from calibration work
  teleop: TeleoperatorConfig; // Teleoperator configuration
  step_size?: number; // Default: 25 (motor position units)
  fps?: number; // Default: 60
  duration_s?: number | null; // Default: null (infinite)
}

interface TeleoperatorConfig {
  type: "keyboard"; // Only keyboard for now, expandable later
}

async function teleoperate(config: TeleoperateConfig): Promise<void>;

// Keyboard control mappings
interface KeyboardControls {
  shoulder_pan: { decrease: string; increase: string }; // left/right arrows
  shoulder_lift: { decrease: string; increase: string }; // down/up arrows
  elbow_flex: { decrease: string; increase: string }; // s/w
  wrist_flex: { decrease: string; increase: string }; // a/d
  wrist_roll: { decrease: string; increase: string }; // q/e
  gripper: { toggle: string }; // space
  emergency_stop: string; // esc
}
```

#### Platform-Specific Keyboard Handling

```typescript
// Node.js keyboard input
class NodeKeyboardController {
  private currentPositions: Record<string, number> = {};
  private robot: NodeSO100Follower;
  private stepSize: number;

  constructor(robot: NodeSO100Follower, stepSize: number = 25) {
    this.robot = robot;
    this.stepSize = stepSize;
  }

  async start(): Promise<void> {
    process.stdin.setRawMode(true);
    process.stdin.on("keypress", this.handleKeypress.bind(this));

    // Initialize current positions from robot
    this.currentPositions = await this.robot.getPositions();
  }

  private async handleKeypress(chunk: any, key: any): Promise<void> {
    let positionChanged = false;

    switch (key.name) {
      case "up":
        this.currentPositions.shoulder_lift += this.stepSize;
        positionChanged = true;
        break;
      case "down":
        this.currentPositions.shoulder_lift -= this.stepSize;
        positionChanged = true;
        break;
      case "left":
        this.currentPositions.shoulder_pan -= this.stepSize;
        positionChanged = true;
        break;
      case "right":
        this.currentPositions.shoulder_pan += this.stepSize;
        positionChanged = true;
        break;
      // ... other key mappings
      case "escape":
        await this.emergencyStop();
        return;
    }

    if (positionChanged) {
      // Apply calibration limits
      this.enforcePositionLimits();
      // Send to robot
      await this.robot.setPositions(this.currentPositions);
    }
  }
}
```

```typescript
// Web keyboard input
class WebKeyboardController {
  private currentPositions: Record<string, number> = {};
  private robot: WebSO100Follower;
  private stepSize: number;
  private keysPressed: Set<string> = new Set();

  constructor(robot: WebSO100Follower, stepSize: number = 25) {
    this.robot = robot;
    this.stepSize = stepSize;
  }

  async start(): Promise<void> {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
    document.addEventListener("keyup", this.handleKeyUp.bind(this));

    // Initialize current positions from robot
    this.currentPositions = await this.robot.getPositions();

    // Start control loop for smooth movement
    this.startControlLoop();
  }

  private handleKeyDown(event: KeyboardEvent): void {
    event.preventDefault();
    this.keysPressed.add(event.code);

    if (event.code === "Escape") {
      this.emergencyStop();
    }
  }

  private async startControlLoop(): Promise<void> {
    setInterval(async () => {
      let positionChanged = false;

      // Check all pressed keys and update positions
      if (this.keysPressed.has("ArrowUp")) {
        this.currentPositions.shoulder_lift += this.stepSize;
        positionChanged = true;
      }
      if (this.keysPressed.has("ArrowDown")) {
        this.currentPositions.shoulder_lift -= this.stepSize;
        positionChanged = true;
      }
      // ... other key checks

      if (positionChanged) {
        this.enforcePositionLimits();
        await this.robot.setPositions(this.currentPositions);
      }
    }, 1000 / 60); // 60 FPS control loop
  }
}
```

### Technical Considerations

#### Reusing Existing Robot Infrastructure

```typescript
// Extend existing robot classes instead of reimplementing
class TeleopSO100Follower extends SO100Follower {
  private calibrationData: CalibrationData;

  constructor(config: RobotConfig) {
    super(config);
    // Load calibration data from existing calibration system
    this.calibrationData = loadCalibrationData(config.id);
  }

  async getPositions(): Promise<Record<string, number>> {
    // Reuse existing position reading logic
    return await this.readCurrentPositions();
  }

  async setPositions(positions: Record<string, number>): Promise<void> {
    // Reuse existing position writing logic with validation
    await this.writePositions(positions);
  }

  enforcePositionLimits(
    positions: Record<string, number>
  ): Record<string, number> {
    // Use calibration data to enforce limits
    for (const [motor, position] of Object.entries(positions)) {
      const limits = this.calibrationData[motor];
      positions[motor] = Math.max(
        limits.range_min,
        Math.min(limits.range_max, position)
      );
    }
    return positions;
  }
}
```

#### Control Loop and Performance

```typescript
// Simple control loop focused on keyboard input
async function keyboardControlLoop(
  keyboardController: KeyboardController,
  robot: TeleopSO100Follower,
  fps: number = 60
): Promise<void> {
  while (true) {
    const loopStart = performance.now();

    // Keyboard controller handles input and robot updates internally
    // Just need to display current status
    const positions = await robot.getPositions();
    displayPositions(positions);

    // Frame rate control
    const loopTime = performance.now() - loopStart;
    const targetLoopTime = 1000 / fps;
    const sleepTime = targetLoopTime - loopTime;

    if (sleepTime > 0) {
      await sleep(sleepTime);
    }

    displayPerformanceMetrics(loopTime, fps);
  }
}
```

#### CLI Arguments (Simplified)

```typescript
// CLI interface matching Python structure
interface TeleoperateConfig {
  robot: {
    type: string; // "so100_follower"
    port: string; // COM port
    id?: string; // robot identifier
  };
  teleop: {
    type: string; // "keyboard"
  };
  step_size?: number; // position step size per keypress
  fps?: number; // control loop frame rate
}

// CLI parsing
program
  .option("--robot.type <type>", "Robot type (so100_follower)")
  .option("--robot.port <port>", "Robot serial port")
  .option("--robot.id <id>", "Robot identifier")
  .option("--teleop.type <type>", "Teleoperator type (keyboard)")
  .option("--step_size <size>", "Position step size per keypress", "25")
  .option("--fps <fps>", "Control loop frame rate", "60");
```

## Definition of Done

- [ ] **Functional**: Successfully controls SO-100 robot arm via keyboard input
- [ ] **CLI Ready**: `npx lerobot teleoperate` provides keyboard control
- [ ] **Intuitive Controls**: Arrow keys, WASD provide natural robot movement
- [ ] **Web Compatible**: Browser-based keyboard teleoperation with modern interface
- [ ] **Cross-Platform**: Node.js works on Windows, macOS, and Linux; Web works in Chromium browsers
- [ ] **Safety Features**: Position limits, emergency stop, connection monitoring
- [ ] **Real-time Feedback**: Live position display and performance metrics
- [ ] **Integration**: Uses existing robot connection and calibration infrastructure
- [ ] **Error Handling**: Graceful handling of connection failures and invalid movements
- [ ] **Type Safe**: Full TypeScript coverage with strict mode for both implementations
- [ ] **Quick Win**: Demonstrable keyboard robot control within minimal development time

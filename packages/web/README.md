# @lerobot/web

interact with your robot in JS (WebSerial + WebUSB), inspired by [LeRobot](https://github.com/huggingface/lerobot)

🚀 **[Try the live demo →](https://huggingface.co/spaces/NERDDISCO/LeRobot.js)**

## Installation

```bash
# pnpm
pnpm add @lerobot/web

# npm
npm install @lerobot/web

# yarn
yarn add @lerobot/web
```

## Quick Start

```typescript
import { findPort, releaseMotors, calibrate, teleoperate } from "@lerobot/web";

// 1. find available robot ports (shows browser port dialog)
console.log("🔍 finding available robot ports...");
const findProcess = await findPort();
const robots = await findProcess.result;

if (robots.length === 0) {
  console.log("❌ no robots found. check connections and try again.");
  return;
}

// 2. connect to the first robot found
console.log(`✅ found ${robots.length} robot(s). using first one...`);
const robot = robots[0]; // already connected from findPort

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
console.log("👋 move robot through full range, then stop calibration...");
// in a real app, you'd have a button to stop calibration
setTimeout(() => {
  calibrationProcess.stop();
}, 10000); // stop after 10 seconds for demo

const calibrationData = await calibrationProcess.result;
console.log("✅ calibration complete!");

// 5. control robot with keyboard
console.log("🎮 starting keyboard control...");
const teleop = await teleoperate({
  robot,
  calibrationData,
  teleop: { type: "keyboard" }, // or { type: "direct" }
});
teleop.start();

// stop control after 30 seconds
setTimeout(() => {
  teleop.stop();
  console.log("🛑 control stopped");
}, 30000);
```

## How It Works

### **`findPort()` - Discovery + Connection in One Step**

In the browser, `findPort()` handles both discovery AND connection testing. It returns ready-to-use robot connections:

```typescript
// ✅ browser workflow: find and connect in one step
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = robots[0]; // ready to use - already connected and tested!
```

**Why no separate `connectPort()`?** The browser's WebSerial API requires user interaction for port access, so `findPort()` handles everything in one user-friendly flow.

**Need direct port connection?** Use `@lerobot/node` which provides `connectPort()` for server-side applications where you know the exact port path (e.g., `"/dev/ttyUSB0"`).

## Core API

### `findPort(config?): Promise<FindPortProcess>`

Discovers and connects to robotics hardware using WebSerial API. Two modes: interactive (shows port dialog) and auto-connect (reconnects to known robots).

#### Interactive Mode (Default)

First-time usage or discovering new robots. Shows native browser port selection dialog.

```typescript
// User selects robot via browser dialog
const findProcess = await findPort();
const robots = await findProcess.result; // RobotConnection[]
const robot = robots[0]; // User-selected robot

// Configure and save robot for future auto-connect
robot.robotType = "so100_follower";
robot.robotId = "my_robot_arm";

// Save to localStorage (or your storage system)
localStorage.setItem(
  `robot-${robot.serialNumber}`,
  JSON.stringify({
    robotType: robot.robotType,
    robotId: robot.robotId,
    serialNumber: robot.serialNumber,
  })
);
```

#### Auto-Connect Mode

Automatically reconnects to previously configured robots without showing dialogs.

```typescript
// Build robotConfigs from saved data
const robotConfigs = [];

// Option 1: Load from localStorage (typical web app pattern)
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key?.startsWith("robot-")) {
    const saved = JSON.parse(localStorage.getItem(key)!);
    robotConfigs.push({
      robotType: saved.robotType,
      robotId: saved.robotId,
      serialNumber: saved.serialNumber,
    });
  }
}

// Option 2: Create manually if you know your robots
const robotConfigs = [
  { robotType: "so100_follower", robotId: "left_arm", serialNumber: "USB123" },
  { robotType: "so100_leader", robotId: "right_arm", serialNumber: "USB456" },
];

// Auto-connect to all known robots
const findProcess = await findPort({
  robotConfigs,
  onMessage: (msg) => console.log(msg),
});

const robots = await findProcess.result;
const connectedRobots = robots.filter((r) => r.isConnected);
console.log(
  `Connected to ${connectedRobots.length}/${robotConfigs.length} robots`
);
```

#### RobotConfig Structure

```typescript
interface RobotConfig {
  robotType: "so100_follower" | "so100_leader";
  robotId: string; // Your custom identifier (e.g., "left_arm")
  serialNumber: string; // Device serial number (from previous findPort)
}
```

#### Options

- `robotConfigs?: RobotConfig[]` - Auto-connect to these known robots
- `onMessage?: (message: string) => void` - Progress messages callback

#### Returns: `FindPortProcess`

- `result: Promise<RobotConnection[]>` - Array of robot connections
- `stop(): void` - Cancel discovery process

---

### `calibrate(config): Promise<CalibrationProcess>`

Calibrates motor homing offsets and records range of motion.

```typescript
const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => {
    console.log(message); // "⚙️ Setting motor homing offsets"
  },
  onLiveUpdate: (data) => {
    // Real-time motor positions during range recording
    Object.entries(data).forEach(([motor, info]) => {
      console.log(`${motor}: ${info.current} (range: ${info.range})`);
    });
  },
});

// Move robot through full range of motion...
// When finished recording ranges, stop the calibration
console.log("Move robot through its range, then stopping in 10 seconds...");
setTimeout(() => {
  calibrationProcess.stop(); // Stop range recording
}, 10000);

const calibrationData = await calibrationProcess.result;
// Save calibration data to localStorage or file
```

#### Options

- `config: CalibrateConfig`
  - `robot: RobotConnection` - Connected robot from `findPort()`
  - `onProgress?: (message: string) => void` - Progress messages
  - `onLiveUpdate?: (data: LiveCalibrationData) => void` - Real-time position updates

#### Returns: `CalibrationProcess`

- `result: Promise<CalibrationResults>` - Calibration data (Python-compatible format)
- `stop(): void` - Stop calibration process

#### Calibration Data Format

**Python Compatible**: This format is identical to Python lerobot calibration files.

```json
{
  "shoulder_pan": {
    "id": 1,
    "drive_mode": 0,
    "homing_offset": 14,
    "range_min": 1015,
    "range_max": 3128
  },
  "shoulder_lift": {
    "id": 2,
    "drive_mode": 0,
    "homing_offset": 989,
    "range_min": 965,
    "range_max": 3265
  },
  "elbow_flex": {
    "id": 3,
    "drive_mode": 0,
    "homing_offset": -879,
    "range_min": 820,
    "range_max": 3051
  },
  "wrist_flex": {
    "id": 4,
    "drive_mode": 0,
    "homing_offset": 31,
    "range_min": 758,
    "range_max": 3277
  },
  "wrist_roll": {
    "id": 5,
    "drive_mode": 0,
    "homing_offset": -37,
    "range_min": 2046,
    "range_max": 3171
  },
  "gripper": {
    "id": 6,
    "drive_mode": 0,
    "homing_offset": -1173,
    "range_min": 2038,
    "range_max": 3528
  }
}
```

---

### `teleoperate(config): Promise<TeleoperationProcess>`

Enables real-time robot control with extensible input devices. Supports keyboard control and direct programmatic movement, with architecture for future input devices like leader arms and joysticks.

#### Keyboard Teleoperation

```typescript
import { teleoperate, KeyboardTeleoperator } from "@lerobot/web";

const keyboardTeleop = await teleoperate({
  robot,
  calibrationData: savedCalibrationData, // From calibrate()
  teleop: { type: "keyboard" }, // Uses keyboard controls
  onStateUpdate: (state) => {
    console.log(`Active: ${state.isActive}`);
    console.log(`Motors:`, state.motorConfigs);
  },
});

// Start keyboard control
keyboardTeleop.start();

// Access keyboard-specific methods
const keyboardController = keyboardTeleop.teleoperator as KeyboardTeleoperator;
await keyboardController.moveMotor("shoulder_pan", 2048);

// Stop when finished
setTimeout(() => keyboardTeleop.stop(), 30000);
```

#### Direct Teleoperation

```typescript
import { teleoperate, DirectTeleoperator } from "@lerobot/web";

const directTeleop = await teleoperate({
  robot,
  calibrationData: savedCalibrationData,
  teleop: { type: "direct" }, // For programmatic control
  onStateUpdate: (state) => {
    console.log(`Motors:`, state.motorConfigs);
  },
});

directTeleop.start();

// Access direct control methods
const directController = directTeleop.teleoperator as DirectTeleoperator;
await directController.moveMotor("shoulder_pan", 2048);
await directController.setMotorPositions({
  shoulder_pan: 2048,
  elbow_flex: 1500,
});

// Stop when finished
setTimeout(() => directTeleop.stop(), 30000);
```

#### Options

- `config: TeleoperateConfig`
  - `robot: RobotConnection` - Connected robot from `findPort()`
  - `teleop: TeleoperatorConfig` - Teleoperator configuration:
    - `{ type: "keyboard", stepSize?: number, updateRate?: number, keyTimeout?: number }` - Keyboard control
    - `{ type: "direct" }` - Direct programmatic control
  - `calibrationData?: { [motorName: string]: any }` - Calibration data from `calibrate()`
  - `onStateUpdate?: (state: TeleoperationState) => void` - State change callback

#### Returns: `TeleoperationProcess`

- `start(): void` - Begin teleoperation
- `stop(): void` - Stop teleoperation and clear states
- `getState(): TeleoperationState` - Current state and motor positions
- `teleoperator: BaseWebTeleoperator` - Access teleoperator-specific methods:
  - **KeyboardTeleoperator**: `updateKeyState()`, `moveMotor()`, etc.
  - **DirectTeleoperator**: `moveMotor()`, `setMotorPositions()`, etc.
- `disconnect(): Promise<void>` - Stop and disconnect

#### Keyboard Controls (SO-100)

```
Arrow Keys: Shoulder pan/lift
WASD: Elbow flex, wrist flex
Q/E: Wrist roll
O/C: Gripper open/close
Escape: Emergency stop
```

---

### `releaseMotors(robot, motorIds?): Promise<void>`

Releases motor torque so robot can be moved freely by hand.

```typescript
// Release all motors for calibration
await releaseMotors(robot);

// Release specific motors only
await releaseMotors(robot, [1, 2, 3]);
```

#### Options

- `robot: RobotConnection` - Connected robot
- `motorIds?: number[]` - Specific motor IDs (default: all motors for robot type)

## Browser Requirements

- **chromium 89+** with WebSerial and WebUSB API support
- **HTTPS or localhost**
- **User gesture** required for initial port selection

## Hardware Support

Currently supports SO-100 follower and leader arms with STS3215 motors. More devices coming soon.

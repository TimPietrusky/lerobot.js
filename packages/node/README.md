# @lerobot/node

Control robots with Node.js (serialport), inspired by [LeRobot](https://github.com/huggingface/lerobot)

🚀 **[Try the live (web) demo →](https://huggingface.co/spaces/NERDDISCO/LeRobot.js)**

## Installation

```bash
# pnpm
pnpm add @lerobot/node

# npm
npm install @lerobot/node

# yarn
yarn add @lerobot/node
```

## Quick Start

```typescript
import {
  findPort,
  connectPort,
  releaseMotors,
  calibrate,
  teleoperate,
} from "@lerobot/node";

// 1. find available robot ports
console.log("🔍 finding available robot ports...");
const findProcess = await findPort();
const robots = await findProcess.result;

if (robots.length === 0) {
  console.log("❌ no robots found. check connections.");
  process.exit(1);
}

// 2. connect to the first robot found
console.log(`✅ found ${robots.length} robot(s). connecting to first one...`);
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
teleop.start();

// stop control after 30 seconds
setTimeout(() => {
  teleop.stop();
  console.log("🛑 control stopped");
}, 30000);
```

## How It Works

### **Beginner Flow: `findPort()` → `connectPort()` → Use Robot**

Most users should start with `findPort()` for discovery, then `connectPort()` for connection:

```typescript
// ✅ recommended: discover then connect
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = await connectPort(robots[0].path, robots[0].robotType);
```

### **Advanced: Direct Connection with `connectPort()`**

Only use `connectPort()` when you already know the exact port:

```typescript
// ⚡ advanced: direct connection to known port
const robot = await connectPort("/dev/ttyUSB0", "so100_follower");
```

## Core API

### `findPort(config?): Promise<FindPortProcess>`

Discovers available robotics hardware on serial ports. Unlike the web version, this only discovers ports - connection happens separately with `connectPort()`.

```typescript
// Discover all available robots
const findProcess = await findPort();
const robots = await findProcess.result;

console.log(`Found ${robots.length} robot(s):`);
robots.forEach((robot) => {
  console.log(`- ${robot.robotType} on ${robot.path}`);
});

// Connect to specific robot
const robot = await connectPort(robots[0].path, robots[0].robotType);
```

#### Options

- `config?: FindPortConfig` - Optional configuration
  - `onMessage?: (message: string) => void` - Progress messages callback

#### Returns: `FindPortProcess`

- `result: Promise<DiscoveredRobot[]>` - Array of discovered robots with `path`, `robotType`, and other metadata
- `stop(): void` - Cancel discovery process

#### DiscoveredRobot Structure

```typescript
interface DiscoveredRobot {
  path: string; // Serial port path (e.g., "/dev/ttyUSB0")
  robotType: "so100_follower" | "so100_leader";
  // Additional metadata...
}
```

---

### `connectPort(port): Promise<RobotConnection>`

Creates a connection to a robot on the specified serial port.

```typescript
// Connect to SO-100 follower arm
const robot = await connectPort(
  "/dev/ttyUSB0", // Serial port path
  "so100_follower", // Robot type
  "my_robot_arm" // Custom robot ID
);

// Windows
const robot = await connectPort("COM4", "so100_follower", "my_robot");

// Connection is ready to use
console.log(`Connected to ${robot.robotType} on ${robot.port.path}`);
```

#### Parameters

- `port: string` - Serial port path (e.g., `/dev/ttyUSB0`, `COM4`)
- `robotType: "so100_follower" | "so100_leader"` - Type of robot
- `robotId: string` - Custom identifier for your robot

#### Returns: `Promise<RobotConnection>`

- Initialized robot connection ready for calibration/teleoperation
- Includes configured motor IDs, keyboard controls, and hardware settings

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
// When finished, stop calibration
calibrationProcess.stop();

const calibrationData = await calibrationProcess.result;

// Save to file (Python-compatible format)
import { writeFileSync } from "fs";
writeFileSync(
  "./my_robot_calibration.json",
  JSON.stringify(calibrationData, null, 2)
);
```

#### Options

- `config: CalibrateConfig`
  - `robot: RobotConnection` - Connected robot from `connectPort()`
  - `onProgress?: (message: string) => void` - Progress messages
  - `onLiveUpdate?: (data: LiveCalibrationData) => void` - Real-time position updates

#### Returns: `CalibrationProcess`

- `result: Promise<CalibrationResults>` - **Python-compatible** calibration data
- `stop(): void` - Stop calibration process

#### Calibration Data Format

**Python Compatible**: This format is identical to Python lerobot calibration files - you can use the same calibration data across both implementations.

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

Real-time robot control with keyboard input. **Smooth, responsive movement** optimized for Node.js.

#### Keyboard Teleoperation

```typescript
const teleop = await teleoperate({
  robot,
  teleop: { type: "keyboard" },
  onStateUpdate: (state) => {
    console.log(`Active: ${state.isActive}`);
    state.motorConfigs.forEach((motor) => {
      console.log(`${motor.name}: ${motor.currentPosition}`);
    });
  },
});

// Start keyboard control
teleop.start();

// Control will be active until stopped
setTimeout(() => teleop.stop(), 60000);
```

#### Options

- `config: TeleoperateConfig`
  - `robot: RobotConnection` - Connected robot
  - `teleop: TeleoperatorConfig` - Teleoperator configuration:
    - `{ type: "keyboard" }` - Keyboard control with optimized defaults
  - `onStateUpdate?: (state: TeleoperationState) => void` - State change callback

#### Returns: `TeleoperationProcess`

- `start(): void` - Begin teleoperation (shows keyboard controls)
- `stop(): void` - Stop teleoperation
- `getState(): TeleoperationState` - Current state and motor positions

#### Keyboard Controls (SO-100)

```
Arrow Keys: Shoulder pan/lift
WASD: Elbow flex, wrist flex
Q/E: Wrist roll
O/C: Gripper open/close
ESC: Emergency stop
Ctrl+C: Exit
```

#### Performance Characteristics

- **120 Hz update rate** for smooth movement
- **Immediate response** on keypress (no delay)
- **8-unit step size** matching browser demo
- **150ms key timeout** for optimal single-tap vs hold behavior

---

### `releaseMotors(robot): Promise<void>`

Releases motor torque so robot can be moved freely by hand.

```typescript
// Release all motors for calibration
await releaseMotors(robot);
console.log("Motors released - you can now move the robot freely");
```

#### Parameters

- `robot: RobotConnection` - Connected robot

---

## CLI Usage

For command-line usage, install the CLI package:

```bash
# Install CLI globally
pnpm add -g lerobot

# Find and connect to robot
npx lerobot find-port

# Calibrate robot
npx lerobot calibrate --robot.type so100_follower --robot.port /dev/ttyUSB0 --robot.id my_robot

# Control robot with keyboard
npx lerobot teleoperate --robot.type so100_follower --robot.port /dev/ttyUSB0 --robot.id my_robot

# Release motors
npx lerobot release-motors --robot.type so100_follower --robot.port /dev/ttyUSB0 --robot.id my_robot
```

**CLI commands are identical to Python lerobot** - same syntax, same behavior, seamless migration.

## Node.js Requirements

- **Node.js 18+**
- **Serial port access** (may require permissions on Linux/macOS)
- **Supported platforms**: Windows, macOS, Linux

### Serial Port Permissions

**Linux/macOS:**

```bash
# Add user to dialout group (Linux)
sudo usermod -a -G dialout $USER

# Set permissions (macOS)
sudo chmod 666 /dev/tty.usbserial-*
```

**Windows:** No additional setup required.

## Hardware Support

Currently supports SO-100 follower and leader arms with STS3215 motors. More devices coming soon.

## Migration from lerobot.py

```python
# Python lerobot
python -m lerobot.calibrate --robot.type so100_follower --robot.port /dev/ttyUSB0

# Node.js equivalent
npx lerobot calibrate --robot.type so100_follower --robot.port /dev/ttyUSB0
```

- **Same commands** - just replace `python -m lerobot.` with `npx lerobot`
- **Same calibration files** - Python and Node.js calibrations are interchangeable

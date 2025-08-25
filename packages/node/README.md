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
  connectPort,
  releaseMotors,
  calibrate,
  teleoperate,
} from "@lerobot/node";

// 1. Connect to robot on specific port
const robot = await connectPort("/dev/ttyUSB0", "so100_follower", "my_robot");

// 2. Release motors for manual positioning
await releaseMotors(robot);

// 3. Calibrate motors by moving through full range
const calibrationProcess = await calibrate({
  robot,
  onProgress: (message) => console.log(message),
  onLiveUpdate: (data) => console.log("Live positions:", data),
});

// Move robot through its range, then stop calibration
console.log("Move robot through range, press Enter when done...");
process.stdin.once("data", () => {
  calibrationProcess.stop();
});

const calibrationData = await calibrationProcess.result;

// 4. Control robot with keyboard
const teleop = await teleoperate({
  robot,
  teleop: { type: "keyboard" },
});
teleop.start();

// Stop control
setTimeout(() => teleop.stop(), 30000);
```

## Core API

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

Calibrates motor homing offsets and records range of motion. **Identical to Python lerobot behavior.**

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

#### Calibration Data Format (Python Compatible)

```json
{
  "shoulder_pan": {
    "id": 1,
    "drive_mode": 0,
    "homing_offset": 47,
    "range_min": 985,
    "range_max": 3085
  },
  "elbow_flex": {
    "id": 2,
    "drive_mode": 0,
    "homing_offset": 1013,
    "range_min": 1200,
    "range_max": 2800
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

// Start keyboard control (shows control instructions)
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

## System Requirements

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

Currently supports **SO-100 follower and leader arms** with STS3215 motors.

### Supported Robots

- `so100_follower` - SO-100 follower arm (6 DOF)
- `so100_leader` - SO-100 leader arm (6 DOF)

### Communication Protocol

- **Feetech STS3215** servo protocol
- **1,000,000 baud** (matches Python lerobot)
- **Event-driven communication** for optimal performance

## Development

### Architecture

Built with **Python lerobot compatibility** as the primary goal:

- **Identical command syntax** and behavior
- **Same calibration file format**
- **Matching motor control protocols**
- **Compatible timing and performance**

### Performance Optimizations

- **Event-driven serial communication** using `serialport` package
- **Progressive timeout patterns** with retry logic
- **Optimized motor update loops** at 120 Hz
- **Memory leak prevention** with proper event cleanup

## Migration from Python lerobot

**@lerobot/node is designed for seamless migration:**

```python
# Python lerobot
python -m lerobot.calibrate --robot.type so100_follower --robot.port /dev/ttyUSB0

# Node.js equivalent
npx lerobot calibrate --robot.type so100_follower --robot.port /dev/ttyUSB0
```

- **Same commands** - just replace `python -m lerobot.` with `npx lerobot`
- **Same calibration files** - Python and Node.js calibrations are interchangeable
- **Same motor behavior** - identical timing, step sizes, and control feel
- **Same output format** - error messages and prompts match Python exactly

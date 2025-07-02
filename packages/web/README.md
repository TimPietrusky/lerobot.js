# @lerobot/web

Browser-native robotics control using WebSerial and WebUSB APIs.

## Features

- **Direct Hardware Control**: STS3215 motor communication via WebSerial API
- **Device Persistence**: WebUSB API for automatic robot reconnection
- **Real-time Teleoperation**: Keyboard control with live motor feedback
- **Motor Calibration**: Automated homing offset and range recording
- **Cross-browser Support**: Chrome/Edge 89+ with HTTPS or localhost
- **TypeScript Native**: Full type safety and IntelliSense support

## Installation

```bash
# pnpm (recommended)
pnpm add @lerobot/web

# npm
npm install @lerobot/web

# yarn
yarn add @lerobot/web
```

## Quick Start

```typescript
import { findPort, releaseMotors, calibrate, teleoperate } from "@lerobot/web";

// 1. Find and connect to hardware
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = robots[0];

// 2. Release motors for manual positioning
await releaseMotors(robot);
console.log("🔓 Motors released - you can move the robot by hand");

// 3. Calibrate motors
const calibrationProcess = await calibrate(robot, {
  onProgress: (message) => console.log(message),
  onLiveUpdate: (data) => console.log("Live positions:", data),
});

// Move robot through its full range of motion...
// When done, stop calibration to proceed
setTimeout(() => {
  console.log("⏱️ Stopping calibration...");
  calibrationProcess.stop();
}, 10000); // Stop after 10 seconds, or call stop() when user is ready

const calibrationData = await calibrationProcess.result;

// 4. Start teleoperation
const teleop = await teleoperate(robot, { calibrationData });
teleop.start();

// Stop teleoperation when done
setTimeout(() => {
  console.log("⏹️ Stopping teleoperation...");
  teleop.stop();
}, 30000); // Stop after 30 seconds, or call stop() when needed
```

## Core API

### `findPort(options?): Promise<FindPortProcess>`

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

### `calibrate(robot, options?): Promise<CalibrationProcess>`

Calibrates motor homing offsets and records range of motion.

```typescript
const calibrationProcess = await calibrate(robot, {
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

#### Parameters

- `robot: RobotConnection` - Connected robot from `findPort()`
- `options?: CalibrationOptions`
  - `onProgress?: (message: string) => void` - Progress messages
  - `onLiveUpdate?: (data: LiveCalibrationData) => void` - Real-time position updates

#### Returns: `CalibrationProcess`

- `result: Promise<WebCalibrationResults>` - Calibration data (Python-compatible format)
- `stop(): void` - Stop calibration process

#### Calibration Data Format

```typescript
{
  "shoulder_pan": {
    "id": 1,
    "drive_mode": 0,
    "homing_offset": 47,
    "range_min": 985,
    "range_max": 3085
  },
  // ... other motors
}
```

---

### `teleoperate(robot, options?): Promise<TeleoperationProcess>`

Enables real-time robot control with keyboard input and programmatic movement.

```typescript
const teleop = await teleoperate(robot, {
  calibrationData: savedCalibrationData, // From calibrate()
  onStateUpdate: (state) => {
    console.log(`Active: ${state.isActive}`);
    console.log(`Motors:`, state.motorConfigs);
  },
});

// Start keyboard control
teleop.start();

// Programmatic control
await teleop.moveMotor("shoulder_pan", 2048);
await teleop.setMotorPositions({
  shoulder_pan: 2048,
  elbow_flex: 1500,
});

// Stop teleoperation when finished
setTimeout(() => {
  console.log("Stopping teleoperation...");
  teleop.stop();
}, 30000); // Or call teleop.stop() when user is done
```

#### Parameters

- `robot: RobotConnection` - Connected robot from `findPort()`
- `options?: TeleoperationOptions`
  - `calibrationData?: { [motorName: string]: any }` - Calibration data from `calibrate()`
  - `onStateUpdate?: (state: TeleoperationState) => void` - State change callback

#### Returns: `TeleoperationProcess`

- `start(): void` - Begin keyboard teleoperation
- `stop(): void` - Stop teleoperation and clear key states
- `updateKeyState(key: string, pressed: boolean): void` - Manual key state control
- `getState(): TeleoperationState` - Current state and motor positions
- `moveMotor(motorName: string, position: number): Promise<boolean>` - Move single motor
- `setMotorPositions(positions: { [motorName: string]: number }): Promise<boolean>` - Move multiple motors
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

#### Parameters

- `robot: RobotConnection` - Connected robot
- `motorIds?: number[]` - Specific motor IDs (default: all motors for robot type)

## Browser Requirements

- **chromium 89+** with WebSerial and WebUSB API support
- **HTTPS or localhost**
- **User gesture** required for initial port selection

## Hardware Support

Currently supports SO-100 follower and leader arms with STS3215 motors. More devices coming soon.

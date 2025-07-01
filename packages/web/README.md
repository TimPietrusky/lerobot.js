# @lerobot/web

Browser-native robotics control using WebSerial API. No Python dependencies required.

## Features

- **Direct Hardware Control**: STS3215 motor communication via WebSerial API
- **Real-time Teleoperation**: Keyboard control with live motor feedback
- **Motor Calibration**: Automated homing offset and range recording
- **Cross-browser Support**: Chrome/Edge 89+ with HTTPS or localhost
- **TypeScript Native**: Full type safety and IntelliSense support

## Installation

```bash
npm install @lerobot/web
```

## Quick Start

```typescript
import { findPort, calibrate, teleoperate } from "@lerobot/web";

// 1. Find and connect to hardware
const findProcess = await findPort();
const robots = await findProcess.result;
const robot = robots[0];

// 2. Calibrate motors
const calibrationProcess = await calibrate(robot, {
  onProgress: (message) => console.log(message),
  onLiveUpdate: (data) => console.log("Live positions:", data),
});
const calibrationData = await calibrationProcess.result;

// 3. Start teleoperation
const teleop = await teleoperate(robot, { calibrationData });
teleop.start();
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

#### Complete Workflow Example

```typescript
// First run: Interactive discovery
async function discoverNewRobots() {
  const findProcess = await findPort();
  const robots = await findProcess.result;

  for (const robot of robots) {
    // Configure each robot
    robot.robotType = "so100_follower"; // User choice
    robot.robotId = `robot_${Date.now()}`; // User input

    // Save for auto-connect
    localStorage.setItem(
      `robot-${robot.serialNumber}`,
      JSON.stringify({
        robotType: robot.robotType,
        robotId: robot.robotId,
        serialNumber: robot.serialNumber,
      })
    );
  }

  return robots;
}

// Subsequent runs: Auto-connect
async function reconnectSavedRobots() {
  // Load saved robot configs
  const robotConfigs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("robot-")) {
      const saved = JSON.parse(localStorage.getItem(key)!);
      robotConfigs.push(saved);
    }
  }

  if (robotConfigs.length === 0) {
    return discoverNewRobots(); // No saved robots, go interactive
  }

  // Auto-connect to saved robots
  const findProcess = await findPort({ robotConfigs });
  return await findProcess.result;
}
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
// Press any key when done

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

// Stop when done
teleop.stop();
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

### `isWebSerialSupported(): boolean`

Checks if WebSerial API is available in the current browser.

```typescript
if (!isWebSerialSupported()) {
  console.log("Please use Chrome/Edge 89+ with HTTPS or localhost");
  return;
}
```

---

### `releaseMotors(robot, motorIds?): Promise<void>`

Releases motor torque so robot can be moved freely by hand.

```typescript
// Release all motors for calibration
await releaseMotors(robot);

// Release specific motors only
await releaseMotors(robot, [1, 2, 3]); // First 3 motors
```

#### Parameters

- `robot: RobotConnection` - Connected robot
- `motorIds?: number[]` - Specific motor IDs (default: all motors for robot type)

## Types

### `RobotConnection`

```typescript
interface RobotConnection {
  port: SerialPort; // WebSerial port object
  name: string; // Display name
  isConnected: boolean; // Connection status
  robotType?: "so100_follower" | "so100_leader";
  robotId?: string; // User-defined ID
  serialNumber: string; // Device serial number
  error?: string; // Error message if failed
}
```

### `WebCalibrationResults`

```typescript
interface WebCalibrationResults {
  [motorName: string]: {
    id: number; // Motor ID (1-6)
    drive_mode: number; // Drive mode (0 for SO-100)
    homing_offset: number; // Calculated offset
    range_min: number; // Minimum position
    range_max: number; // Maximum position
  };
}
```

### `TeleoperationState`

```typescript
interface TeleoperationState {
  isActive: boolean; // Whether teleoperation is running
  motorConfigs: MotorConfig[]; // Current motor positions and limits
  lastUpdate: number; // Timestamp of last update
  keyStates: { [key: string]: { pressed: boolean; timestamp: number } };
}
```

### `MotorConfig`

```typescript
interface MotorConfig {
  id: number; // Motor ID
  name: string; // Motor name (e.g., "shoulder_pan")
  currentPosition: number; // Current position
  minPosition: number; // Position limit minimum
  maxPosition: number; // Position limit maximum
}
```

### `RobotConfig`

```typescript
interface RobotConfig {
  robotType: "so100_follower" | "so100_leader";
  robotId: string; // Your custom identifier (e.g., "left_arm")
  serialNumber: string; // Device serial number (from previous findPort)
}
```

## Advanced Usage

### Custom Motor Communication

```typescript
import {
  WebSerialPortWrapper,
  readMotorPosition,
  writeMotorPosition,
} from "@lerobot/web";

const port = new WebSerialPortWrapper(robotConnection.port);
await port.initialize();

// Read motor position directly
const position = await readMotorPosition(port, 1);

// Write motor position directly
await writeMotorPosition(port, 1, 2048);
```

### Robot Configuration

```typescript
import { createSO100Config, SO100_KEYBOARD_CONTROLS } from "@lerobot/web";

const config = createSO100Config("so100_follower");
console.log("Motor names:", config.motorNames);
console.log("Motor IDs:", config.motorIds);
console.log("Keyboard controls:", SO100_KEYBOARD_CONTROLS);
```

### Low-Level Motor Control

```typescript
import { releaseMotorsLowLevel } from "@lerobot/web";

const port = new WebSerialPortWrapper(robotConnection.port);
await port.initialize();

// Release specific motors at low level
await releaseMotorsLowLevel(port, [1, 2, 3]);
```

## Error Handling

```typescript
try {
  const findProcess = await findPort();
  const robots = await findProcess.result;

  if (robots.length === 0) {
    throw new Error("No robots found");
  }

  const robot = robots[0];
  if (!robot.isConnected) {
    throw new Error(`Failed to connect: ${robot.error}`);
  }

  // Proceed with calibration/teleoperation
} catch (error) {
  console.error("Robot connection failed:", error.message);
}
```

## Browser Requirements

- **Chrome/Edge 89+** with WebSerial API support
- **HTTPS or localhost** (required for WebSerial API)
- **User gesture** required for initial port selection

## Hardware Support

Currently supports SO-100 follower and leader arms with STS3215 motors. More devices coming soon.

## License

Apache-2.0

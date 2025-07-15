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
// which we need to control the robot in its defined ranges
calibrationProcess.stop();
const calibrationData = await calibrationProcess.result;

// 4. start controlling the robot arm with your keyboard
const teleop = await teleoperate({
  robot,
  calibrationData,
  teleop: { type: "keyboard" }, // or { type: "direct" }
});
teleop.start();

// stop any control
teleop.stop();
```

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

---

## Dataset Export

### `LeRobotDatasetRecorder`: Recording and Exporting Data for Machine Learning

The `LeRobotDatasetRecorder` enables recording robot control sessions and exporting them in the [LeRobot dataset format](https://github.com/huggingface/lerobot#the-lerobotdataset-format) for machine learning training.

```typescript
import { LeRobotDatasetRecorder } from '@lerobot/web';

// Create a recorder instance with teleoperator and video streams
const recorder = new LeRobotDatasetRecorder({
  teleoperator: teleop,
  videoElements: {
    front: frontCameraVideoElement,
    side: sideCameraVideoElement
  },
  taskDescription: "Pick and place task"
});

// Start recording an episode
recorder.startRecording(0); // episodeIndex = 0

// ... perform teleoperator actions ...

// Stop recording
recorder.stopRecording();

// Start another episode
recorder.startRecording(1); // episodeIndex = 1

// ... perform more teleoperator actions ...

// Stop recording
recorder.stopRecording();

// Export the full dataset including videos
const zipBlob = await recorder.exportForLeRobot();

// Save to file
const url = URL.createObjectURL(zipBlob);
const a = document.createElement('a');
a.href = url;
a.download = 'lerobot-dataset.zip';
a.click();
URL.revokeObjectURL(url);
```

#### Adding Video Streams Dynamically

You can add additional video streams after initialization:

```typescript
// Get user media stream from camera
const stream = await navigator.mediaDevices.getUserMedia({ video: true });

// Add to recorder with a key name
recorder.addVideoStream('distance', stream);
```

#### Dataset Structure

The exported zip contains the following structure:

```
/data/chunk-000/file-000.parquet  # Teleoperator actions
/videos/observation.images.{camera-key}/chunk-000/file-000.mp4  # Video recordings
/meta/info.json  # Dataset metadata
/meta/stats.json  # Dataset statistics
/meta/tasks.parquet  # Task descriptions
/meta/episodes/chunk-000/file-000.parquet  # Episode statistics
/README.md  # Dataset documentation
```

#### Parquet Data Structure and Arrow Arrays

The recorder handles complex array data structures by using Apache Arrow Lists with named fields to ensure parquet-wasm compatibility:

```typescript
// Array field handling for parquet serialization
// 1. For count arrays (integer data)
columns['field/count'] = vectorFromArray(
  values, 
  new arrow.List(new arrow.Field("item", new arrow.Int64()))
);

// 2. For image statistics (3D arrays)
columns['observation.images.front/mean'] = vectorFromArray(
  values,
  new arrow.List(new arrow.Field("item", 
    new arrow.List(new arrow.Field("subitem", 
      new arrow.List(new arrow.Field("value", new arrow.Float64()))
    ))
  ))
);

// 3. For standard 1D float arrays
columns['field/mean'] = vectorFromArray(
  values,
  new arrow.List(new arrow.Field("item", new arrow.Float64()))
);
```

This structure ensures that array data is properly serialized in the parquet files and can be loaded correctly in Python using libraries like pandas, pyarrow, or the LeRobot dataset loader.

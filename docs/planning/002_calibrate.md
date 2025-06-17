# User Story 002: Robot Calibration

## Story

**As a** robotics developer setting up SO-100 robot arms  
**I want** to calibrate my robot arms to establish proper motor positions and limits  
**So that** my robot operates safely and accurately within its intended range of motion

## Background

Robot calibration is a critical setup step that establishes the zero positions, movement limits, and safety parameters for robotic arms. The Python lerobot provides a `calibrate.py` script that:

1. Connects to the specified robot (follower) or teleoperator (leader)
2. Runs the calibration procedure to set motor positions and limits
3. Saves calibration data for future robot operations
4. Ensures safe operation by establishing proper movement boundaries

The calibration process uses the USB ports identified by the `find_port` functionality from User Story 001, and supports both robot arms (followers) and teleoperators (leaders).

## Acceptance Criteria

### Core Functionality

- [x] **Robot Connection**: Connect to robot using discovered USB port from find_port
- [x] **Robot Types**: Support SO-100 follower robot type
- [x] **Teleoperator Support**: Support SO-100 leader teleoperator
- [x] **Calibration Process**: Run device-specific calibration procedures
- [x] **Configuration Management**: Handle robot-specific configuration parameters
- [x] **Cross-Platform**: Work on Windows, macOS, and Linux
- [x] **CLI Interface**: Provide `npx lerobot calibrate` command identical to Python version

### User Experience

- [x] **Clear Feedback**: Show calibration progress and status messages
- [x] **Error Handling**: Handle connection failures, calibration errors gracefully
- [x] **Safety Validation**: Confirm successful calibration before completion
- [x] **Results Display**: Show calibration completion status and saved configuration

### Technical Requirements

- [x] **Dual Platform**: Support both Node.js (CLI) and Web (browser) platforms
- [x] **Node.js Implementation**: Use serialport package for Node.js serial communication
- [x] **Web Implementation**: Use Web Serial API for browser serial communication
- [x] **TypeScript**: Fully typed implementation following project conventions
- [x] **CLI Tool**: Executable via `npx lerobot calibrate` (matching Python version)
- [x] **Configuration Storage**: Save/load calibration data to appropriate locations per platform
- [x] **Platform Abstraction**: Abstract robot/teleoperator interfaces work on both platforms

## Expected User Flow

### Node.js CLI Calibration (Traditional)

```bash
$ npx lerobot calibrate --robot.type=so100_follower --robot.port=COM4 --robot.id=my_follower_arm

Calibrating robot...
Robot type: so100_follower
Port: COM4
ID: my_follower_arm

Connecting to robot...
Connected successfully.
Starting calibration procedure...
Calibration completed successfully.
Configuration saved to: ~/.cache/huggingface/lerobot/calibration/robots/so100_follower/my_follower_arm.json
Disconnecting from robot...
```

### Web Browser Calibration (Interactive)

```typescript
// In a web application
import { calibrate } from "lerobot/web/calibrate";

// Must be triggered by user interaction (button click)
await calibrate({
  robot: {
    type: "so100_follower",
    id: "my_follower_arm",
    // port will be selected by user via browser dialog
  },
});

// Browser shows port selection dialog
// User selects robot from available serial ports
// Calibration proceeds similar to CLI version
// Configuration saved to browser storage or downloaded as file
```

### Teleoperator Calibration

```bash
$ npx lerobot calibrate --teleop.type=so100_leader --teleop.port=COM3 --teleop.id=my_leader_arm

Calibrating teleoperator...
Teleoperator type: so100_leader
Port: COM3
ID: my_leader_arm

Connecting to teleoperator...
Connected successfully.
Starting calibration procedure...
Please follow the on-screen instructions to move the teleoperator through its range of motion...
Calibration completed successfully.
Configuration saved to: ~/.cache/huggingface/lerobot/calibration/teleoperators/so100_leader/my_leader_arm.json
Disconnecting from teleoperator...
```

### Error Handling

```bash
$ npx lerobot calibrate --robot.type=so100_follower --robot.port=COM99

Error: Could not connect to robot on port COM99
Please verify:
1. The robot is connected to the specified port
2. No other application is using the port
3. You have permission to access the port

Use 'npx lerobot find-port' to discover available ports.
```

## Implementation Details

### File Structure

```
src/lerobot/
├── node/
│   ├── calibrate.ts              # Node.js calibration logic (uses serialport)
│   ├── robots/
│   │   ├── config.ts             # Shared robot configuration types
│   │   ├── robot.ts              # Node.js Robot base class
│   │   └── so100_follower.ts     # Node.js SO-100 follower implementation
│   └── teleoperators/
│       ├── config.ts             # Shared teleoperator configuration types
│       ├── teleoperator.ts       # Node.js Teleoperator base class
│       └── so100_leader.ts       # Node.js SO-100 leader implementation
└── web/
    ├── calibrate.ts              # Web calibration logic (uses Web Serial API)
    ├── robots/
    │   ├── robot.ts              # Web Robot base class
    │   └── so100_follower.ts     # Web SO-100 follower implementation
    └── teleoperators/
        ├── teleoperator.ts       # Web Teleoperator base class
        └── so100_leader.ts       # Web SO-100 leader implementation

src/cli/
└── index.ts                      # CLI entry point (Node.js only)
```

### Key Dependencies

#### Node.js Platform

- **serialport**: For Node.js serial communication
- **commander**: For CLI argument parsing (matching Python argparse style)
- **fs/promises**: For configuration file management
- **os**: Node.js built-in for cross-platform home directory detection
- **path**: Node.js built-in for path manipulation

#### Web Platform

- **Web Serial API**: Built-in browser API (no external dependencies)
- **File System Access API**: For configuration file management (when available)
- **Streams API**: Built-in browser streams for data handling

### Platform API Differences

The Web Serial API and Node.js serialport APIs are **completely different** and require separate implementations:

#### Node.js Serial API (Traditional)

```typescript
// Node.js - Event-based, programmatic access
import { SerialPort } from "serialport";

// List ports programmatically
const ports = await SerialPort.list();

// Create port instance
const port = new SerialPort({
  path: "COM4",
  baudRate: 1000000, // Correct baudRate for Feetech motors (SO-100)
});

// Event-based data handling
port.on("data", (data) => {
  console.log("Received:", data.toString());
});

// Direct write
port.write("command\r\n");
```

#### Web Serial API (Modern)

```typescript
// Web - Promise-based, user permission required
// Request port (requires user interaction)
const port = await navigator.serial.requestPort();

// Open with options
await port.open({ baudRate: 1000000 }); // Correct baudRate for Feetech motors (SO-100)

// Stream-based data handling
const reader = port.readable.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log("Received:", new TextDecoder().decode(value));
}

// Stream-based write
const writer = port.writable.getWriter();
await writer.write(new TextEncoder().encode("command\r\n"));
writer.releaseLock();
```

### Core Functions to Implement

#### Shared Interface

```typescript
// calibrate.ts (matching Python naming and structure)
interface CalibrateConfig {
  robot?: RobotConfig;
  teleop?: TeleoperatorConfig;
}

async function calibrate(config: CalibrateConfig): Promise<void>;

// Robot/Teleoperator base classes (platform-agnostic)
abstract class Robot {
  abstract connect(calibrate?: boolean): Promise<void>;
  abstract calibrate(): Promise<void>;
  abstract disconnect(): Promise<void>;
}

abstract class Teleoperator {
  abstract connect(calibrate?: boolean): Promise<void>;
  abstract calibrate(): Promise<void>;
  abstract disconnect(): Promise<void>;
}
```

#### Platform-Specific Implementations

```typescript
// Node.js implementation
class NodeRobot extends Robot {
  private port: SerialPort;
  // Uses serialport package
}

// Web implementation
class WebRobot extends Robot {
  private port: SerialPort; // Web Serial API SerialPort
  // Uses navigator.serial API
}
```

### Configuration Types

```typescript
interface RobotConfig {
  type: "so100_follower";
  port: string;
  id?: string;
  calibration_dir?: string;
  // SO-100 specific options
  disable_torque_on_disconnect?: boolean;
  max_relative_target?: number | null;
  use_degrees?: boolean;
}

interface TeleoperatorConfig {
  type: "so100_leader";
  port: string;
  id?: string;
  calibration_dir?: string;
  // SO-100 leader specific options
}
```

### Technical Considerations

#### Configuration Management

- **Storage Location**: `{HF_HOME}/lerobot/calibration/robots/{robot_name}/{robot_id}.json` (matching Python version)
- **HF_HOME Discovery**: Use Node.js equivalent of `huggingface_hub.constants.HF_HOME`
  - Default: `~/.cache/huggingface` (Linux/macOS) or `%USERPROFILE%\.cache\huggingface` (Windows)
  - Environment variable: `HF_HOME` can override the default
  - Environment variable: `HF_LEROBOT_CALIBRATION` can override the calibration directory
- **File Format**: JSON for cross-platform compatibility
- **Directory Structure**: `calibration/robots/{robot_name}/` where robot_name matches the robot type

#### Safety Features

- **Movement Limits**: Enforce maximum relative target constraints
- **Torque Management**: Handle torque disable on disconnect
- **Error Recovery**: Graceful handling of calibration failures

#### Device Communication

- **Serial Protocol**: Match Python implementation's communication protocol
- **Timeout Handling**: Appropriate timeouts for device responses
- **Connection Validation**: Verify device is responding before calibration

#### Platform-Specific Challenges

**Node.js Platform:**

- **Port Access**: Direct system-level port access
- **Port Discovery**: Programmatic port listing via `SerialPort.list()`
- **Event Handling**: Traditional callback/event-based patterns
- **Error Handling**: System-level error codes and messages

**Web Platform:**

- **User Permission**: Requires user interaction for port selection
- **Limited Discovery**: Cannot programmatically list ports
- **Stream-Based**: Modern Promise/Stream-based patterns
- **Browser Security**: Limited to what browser security model allows
- **Configuration Storage**: Use browser storage APIs (localStorage/IndexedDB) or File System Access API

#### CLI Argument Parsing

- **Exact Matching**: Command line arguments must match Python version exactly
- **Validation**: Input validation for robot types, ports, and IDs
- **Help Text**: Identical help text and usage examples as Python version

#### Hugging Face Directory Discovery (Node.js)

```typescript
// Equivalent to Python's huggingface_hub.constants.HF_HOME
function getHfHome(): string {
  if (process.env.HF_HOME) {
    return process.env.HF_HOME;
  }

  const homeDir = os.homedir();
  if (process.platform === "win32") {
    return path.join(homeDir, ".cache", "huggingface");
  } else {
    return path.join(homeDir, ".cache", "huggingface");
  }
}

// Equivalent to Python's HF_LEROBOT_CALIBRATION
function getCalibrationDir(): string {
  if (process.env.HF_LEROBOT_CALIBRATION) {
    return process.env.HF_LEROBOT_CALIBRATION;
  }

  return path.join(getHfHome(), "lerobot", "calibration");
}
```

## Definition of Done

- [x] **Functional**: Successfully calibrates SO-100 robots and teleoperators on both platforms
- [x] **CLI Compatible**: `npx lerobot calibrate` matches Python `python -m lerobot.calibrate`
- [x] **Web Compatible**: Browser-based calibration with Web Serial API
- [x] **Cross-Platform**: Node.js works on Windows, macOS, and Linux; Web works in Chromium browsers
- [x] **Tested**: Unit tests for core logic, integration tests with mock devices for both platforms
- [x] **Error Handling**: Platform-appropriate error handling and user-friendly messages
- [x] **Configuration**: Platform-appropriate configuration storage (filesystem vs browser storage)
- [x] **Type Safe**: Full TypeScript coverage with strict mode for both implementations
- [x] **Follows Conventions**: Matches Python lerobot UX/API exactly (CLI), provides intuitive web UX
- [x] **Integration**: Node.js works with ports discovered by User Story 001; Web uses browser port selection

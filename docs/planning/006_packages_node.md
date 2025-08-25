# User Story 006: Node.js Package Architecture

## Story

**As a** robotics developer building server-side applications, CLI tools, and desktop robotics software  
**I want** to use lerobot.js functionality directly from Node.js with the same API as the web version  
**So that** I can build Node.js applications, command-line tools, and desktop software without browser constraints while maintaining familiar APIs

## Background

We have successfully implemented `packages/web` that provides `findPort`, `calibrate`, `releaseMotors`, and `teleoperate` functionality using Web APIs (Web Serial, Web USB). This package is published as `@lerobot/web` and provides a clean, typed API for browser-based robotics applications.

We also have existing Node.js code in `src/lerobot/node` that was working but abandoned when we focused on getting the web version right. Now that the web version is stable and proven, we want to create a proper `packages/node` package that:

1. **Mirrors the Web API**: Provides the same function signatures and behavior as `@lerobot/web`
2. **Uses Node.js APIs**: Leverages `serialport` instead of Web Serial for hardware communication
3. **Python lerobot Faithfulness**: Maintains exact compatibility with Python lerobot CLI commands and behavior
4. **Server-Side Ready**: Enables robotics applications in Node.js servers, CLI tools, and desktop applications
5. **Reuses Proven Logic**: Builds on existing `src/lerobot/node` code that was already working

This will enable developers to use the same lerobot.js API in both browser and Node.js environments, choosing the appropriate platform based on their application needs.

## Acceptance Criteria

### Core Functionality

- [ ] **Same API Surface**: Mirror `@lerobot/web` API with identical function signatures where possible
- [ ] **Four Core Functions**: Implement `findPort`, `calibrate`, `releaseMotors`, and `teleoperate`
- [ ] **SerialPort Integration**: Use `serialport` package instead of Web Serial API
- [ ] **TypeScript Support**: Full TypeScript coverage with strict type checking
- [ ] **NPM Package**: Published as `@lerobot/node` with proper package.json

### Platform Requirements

- [ ] **Node.js 18+**: Support current LTS and newer versions
- [ ] **Cross-Platform**: Work on Windows, macOS, and Linux
- [ ] **ES Modules**: Use ES module format for consistency with web package
- [ ] **CLI Integration**: Enable `npx lerobot` commands using this package
- [ ] **No Browser Dependencies**: No Web API dependencies or browser-specific code

### API Alignment

- [ ] **Same Types**: Reuse or mirror types from `@lerobot/web` where appropriate
- [ ] **Same Exports**: Mirror the export structure of `@lerobot/web/index.ts`
- [ ] **Same Behavior**: Identical behavior for shared functionality (calibration algorithms, motor control)
- [ ] **Platform-Specific Adaptations**: Handle Node.js-specific differences (file system, process management)

### Code Quality

- [ ] **Reuse Existing Code**: Build on proven `src/lerobot/node` implementations
- [ ] **No Code Duplication**: Share logic with web package where possible (copy for now, per requirements)
- [ ] **Clean Architecture**: Follow the same patterns as `packages/web`
- [ ] **Comprehensive Testing**: Unit tests for all core functionality

## Expected User Flow

### Installation and Usage

```bash
# Install the Node.js package
npm install @lerobot/node

# Use in Node.js applications
import { findPort, calibrate, teleoperate } from "@lerobot/node";
```

### Find Port (Node.js)

```typescript
// Node.js - programmatic usage
import { findPort } from "@lerobot/node";

const portProcess = await findPort();
const availablePorts = await portProcess.getAvailablePorts();
console.log("Available ports:", availablePorts);

// Interactive mode (CLI-like) - matches Python lerobot exactly
const portProcess = await findPort({
  interactive: true, // shows "disconnect cable" prompts like Python
});
const detectedPort = await portProcess.detectPort();
```

### Calibration (Node.js)

```typescript
// Node.js - same API as web
import { calibrate } from "@lerobot/node";

const calibrationProcess = await calibrate({
  robot: {
    type: "so100_follower",
    port: "/dev/ttyUSB0", // or "COM4" on Windows
    robotId: "my_follower_arm",
  },
  onLiveUpdate: (data) => {
    console.log("Live calibration data:", data);
  },
});

const results = await calibrationProcess.result;
console.log("Calibration completed:", results);
```

### Teleoperation (Node.js)

```typescript
// Node.js - same API as web
import { teleoperate } from "@lerobot/node";

const teleoperationProcess = await teleoperate({
  robot: {
    type: "so100_follower",
    port: "/dev/ttyUSB0",
    robotId: "my_follower_arm",
  },
  teleop: {
    type: "keyboard",
    stepSize: 25,
  },
  calibrationData: loadedCalibrationData,
  onStateUpdate: (state) => {
    console.log("Robot state:", state);
  },
});

teleoperationProcess.start();
```

### Release Motors (Node.js)

```typescript
// Node.js - same API as web
import { releaseMotors } from "@lerobot/node";

await releaseMotors({
  robot: {
    type: "so100_follower",
    port: "/dev/ttyUSB0",
    robotId: "my_follower_arm",
  },
});
```

### CLI Integration

```bash
# Python lerobot compatibility - same commands work
npx lerobot find-port
npx lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0
npx lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0

# Global installation also works
npm install -g @lerobot/node
lerobot find-port
lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0
```

## Implementation Details

### File Structure

```
packages/node/
├── package.json                    # NPM package configuration
├── tsconfig.build.json             # TypeScript build configuration
├── README.md                       # Package documentation
├── CHANGELOG.md                    # Version history
└── src/
    ├── index.ts                    # Main exports (mirror web package)
    ├── find_port.ts                # Port discovery using serialport
    ├── calibrate.ts                # Calibration using Node.js APIs
    ├── teleoperate.ts              # Teleoperation using Node.js APIs
    ├── release_motors.ts           # Motor release using Node.js APIs
    ├── types/
    │   ├── robot-connection.ts     # Robot connection types
    │   ├── port-discovery.ts       # Port discovery types
    │   ├── calibration.ts          # Calibration types
    │   ├── teleoperation.ts        # Teleoperation types
    │   └── robot-config.ts         # Robot configuration types
    ├── utils/
    │   ├── serial-port-wrapper.ts  # SerialPort wrapper
    │   ├── motor-communication.ts  # Motor communication utilities
    │   ├── motor-calibration.ts    # Calibration utilities
    │   └── sts3215-protocol.ts     # Protocol constants
    ├── robots/
    │   └── so100_config.ts         # SO-100 configuration
    └── teleoperators/
        ├── index.ts                # Teleoperator exports
        ├── base-teleoperator.ts    # Base teleoperator class
        └── keyboard-teleoperator.ts # Keyboard teleoperator
```

### Key Dependencies

#### Core Dependencies

- **serialport**: Node.js serial communication (replaces Web Serial API)
- **chalk**: Terminal colors and formatting
- **commander**: CLI argument parsing

#### Development Dependencies

- **typescript**: TypeScript compiler
- **@types/node**: Node.js type definitions
- **vitest**: Testing framework

### Migration Strategy

#### Phase 1: Package Setup

- [ ] Create `packages/node` directory structure
- [ ] Set up package.json with proper exports
- [ ] Configure TypeScript build process
- [ ] Set up testing infrastructure

#### Phase 2: Core Function Migration

- [ ] Migrate `src/lerobot/node/find_port.ts` to `packages/node/src/find_port.ts`
- [ ] Migrate `src/lerobot/node/calibrate.ts` to `packages/node/src/calibrate.ts`
- [ ] Migrate `src/lerobot/node/teleoperate.ts` to `packages/node/src/teleoperate.ts`
- [ ] Create `release_motors.ts` using existing motor communication code

#### Phase 3: API Alignment

- [ ] Ensure all functions match `@lerobot/web` signatures
- [ ] Copy and adapt types from `packages/web/src/types/`
- [ ] Update utilities to use serialport instead of Web Serial
- [ ] Test API compatibility with existing web examples

#### Phase 4: Testing and Documentation

- [ ] Create comprehensive tests for all functions
- [ ] Update documentation and examples
- [ ] Validate Python lerobot CLI compatibility
- [ ] Test cross-platform compatibility

### Core Functions to Implement

#### Package Exports (Mirror Web Package)

```typescript
// packages/node/src/index.ts
export { calibrate } from "./calibrate.js";
export { teleoperate } from "./teleoperate.js";
export { findPort } from "./find_port.js";
export { releaseMotors } from "./release_motors.js";

// Types (mirror web package)
export type {
  RobotConnection,
  RobotConfig,
  SerialPort,
  SerialPortInfo,
  SerialOptions,
} from "./types/robot-connection.js";

export type {
  FindPortConfig,
  FindPortProcess,
} from "./types/port-discovery.js";

export type {
  CalibrateConfig,
  CalibrationResults,
  LiveCalibrationData,
  CalibrationProcess,
} from "./types/calibration.js";

export type {
  MotorConfig,
  TeleoperationState,
  TeleoperationProcess,
  TeleoperateConfig,
  TeleoperatorConfig,
} from "./types/teleoperation.js";

// Node.js utilities
export { NodeSerialPortWrapper } from "./utils/serial-port-wrapper.js";
export { createSO100Config } from "./robots/so100_config.js";
```

#### SerialPort Wrapper (Node.js)

```typescript
// packages/node/src/utils/serial-port-wrapper.ts
import { SerialPort } from "serialport";

export class NodeSerialPortWrapper {
  private port: SerialPort;
  private isConnected: boolean = false;

  constructor(path: string, options: any = {}) {
    this.port = new SerialPort({
      path,
      baudRate: options.baudRate || 1000000,
      dataBits: options.dataBits || 8,
      parity: options.parity || "none",
      stopBits: options.stopBits || 1,
      autoOpen: false,
    });
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.port.open((err) => {
        if (err) {
          reject(err);
        } else {
          this.isConnected = true;
          resolve();
        }
      });
    });
  }

  async writeAndRead(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      this.port.write(Buffer.from(data), (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Wait for response
        setTimeout(() => {
          this.port.read((readErr, readData) => {
            if (readErr) {
              reject(readErr);
            } else {
              resolve(new Uint8Array(readData || []));
            }
          });
        }, 10); // 10ms delay for response
      });
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.port.close(() => {
        this.isConnected = false;
        resolve();
      });
    });
  }
}
```

#### Find Port Implementation

```typescript
// packages/node/src/find_port.ts - Build on existing code
import { SerialPort } from "serialport";

export interface FindPortConfig {
  interactive?: boolean;
}

export interface FindPortProcess {
  getAvailablePorts(): Promise<string[]>;
  detectPort(): Promise<string>; // Interactive cable detection like Python
}

export async function findPort(
  config: FindPortConfig = {}
): Promise<FindPortProcess> {
  const { interactive = false } = config;

  return {
    async getAvailablePorts(): Promise<string[]> {
      // Use existing implementation from src/lerobot/node/find_port.ts
      const ports = await SerialPort.list();
      return ports.map((port) => port.path);
    },

    async detectPort(): Promise<string> {
      if (interactive) {
        // Existing Python-compatible implementation from src/lerobot/node/find_port.ts
        // Shows "disconnect cable" prompts and detects port automatically
        console.log("Finding all available ports for the MotorsBus.");

        const portsBefore = await this.getAvailablePorts();
        console.log(
          "Remove the USB cable from your MotorsBus and press Enter when done."
        );
        // ... wait for user input ...

        const portsAfter = await this.getAvailablePorts();
        const portsDiff = portsBefore.filter(
          (port) => !portsAfter.includes(port)
        );

        if (portsDiff.length === 1) {
          return portsDiff[0];
        } else {
          throw new Error("Could not detect port");
        }
      } else {
        // Programmatic mode - return first available port
        const ports = await this.getAvailablePorts();
        return ports[0];
      }
    },
  };
}
```

### Technical Considerations

#### API Compatibility with Web Package

The Node.js package should maintain the same API surface as the web package where possible:

```typescript
// Same function signatures
await calibrate(config); // Both packages
await teleoperate(config); // Both packages
await findPort(config); // Both packages
await releaseMotors(config); // Both packages
```

#### Platform-Specific Adaptations

**File System Access:**

- Node.js: Direct file system access for calibration data
- Web: localStorage/IndexedDB for calibration data

**Process Management:**

- Node.js: Process signals, stdin/stdout handling
- Web: Browser events, DOM keyboard handling

**Error Handling:**

- Node.js: Process exit codes, console.error
- Web: User-friendly error dialogs

#### Python lerobot CLI Compatibility

The Node.js package must maintain exact Python lerobot CLI compatibility:

```bash
# These commands must work identically
npx lerobot find-port
npx lerobot calibrate --robot.type=so100_follower --robot.port=/dev/ttyUSB0
npx lerobot teleoperate --robot.type=so100_follower --robot.port=/dev/ttyUSB0
```

#### Calibration Data Storage Location

The CLI should store calibration data in the same location as Python lerobot:

```bash
# Default location (matches Python lerobot)
~/.cache/huggingface/lerobot/calibration/robots/
```

This ensures calibration files are compatible between Python lerobot and Node.js lerobot:

```typescript
// Use HF_HOME environment variable like Python lerobot
const HF_HOME =
  process.env.HF_HOME || path.join(os.homedir(), ".cache", "huggingface");
const CALIBRATION_DIR = path.join(HF_HOME, "lerobot", "calibration", "robots");
```

### Package Configuration

#### package.json

```json
{
  "name": "@lerobot/node",
  "version": "0.1.0",
  "description": "Node.js-based robotics control using SerialPort",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "lerobot": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./calibrate": {
      "import": "./dist/calibrate.js",
      "types": "./dist/calibrate.d.ts"
    },
    "./teleoperate": {
      "import": "./dist/teleoperate.js",
      "types": "./dist/teleoperate.d.ts"
    },
    "./find-port": {
      "import": "./dist/find_port.js",
      "types": "./dist/find_port.d.ts"
    }
  },
  "files": ["dist/**/*", "README.md"],
  "keywords": [
    "robotics",
    "serialport",
    "hardware-control",
    "nodejs",
    "typescript"
  ],
  "scripts": {
    "build": "tsc --project tsconfig.build.json",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "serialport": "^12.0.0",
    "chalk": "^5.3.0",
    "commander": "^11.0.0"
  },
  "peerDependencies": {
    "typescript": ">=4.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

## Definition of Done

- [ ] **Package Structure**: Complete `packages/node` directory with proper NPM package setup
- [ ] **API Mirror**: All four core functions (`findPort`, `calibrate`, `releaseMotors`, `teleoperate`) implemented with same API as web package
- [ ] **SerialPort Integration**: All hardware communication uses `serialport` package instead of Web Serial
- [ ] **Type Safety**: Full TypeScript coverage with strict type checking
- [ ] **Code Migration**: Existing `src/lerobot/node` code successfully migrated and enhanced
- [ ] **Cross-Platform**: Works on Windows, macOS, and Linux with Node.js 18+
- [ ] **CLI Integration**: `npx lerobot` commands work using the Node.js package
- [ ] **Python Compatibility**: CLI commands match Python lerobot behavior exactly
- [ ] **NPM Ready**: Package published as `@lerobot/node` with proper versioning
- [ ] **Documentation**: Complete README with usage examples and API documentation
- [ ] **Testing**: Comprehensive test suite covering all core functionality
- [ ] **No Regressions**: All existing Node.js functionality preserved and enhanced

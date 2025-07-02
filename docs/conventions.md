# LeRobot.js Conventions

## Project Overview

**lerobot.js** is a TypeScript/JavaScript implementation of Hugging Face's [lerobot](https://github.com/huggingface/lerobot) robotics library. Our goal is to bring state-of-the-art AI for real-world robotics directly to the JavaScript ecosystem, enabling robot control without any Python dependencies.

### Vision Statement

> Lower the barrier to entry for robotics by making cutting-edge robotic AI accessible through JavaScript, the world's most widely used programming language.

## Core Rules

- **Never Start/Stop Dev Server**: The development server is already managed by the user - never run commands to start, stop, or restart the server
- **Python lerobot Faithfulness**: Maintain exact UX/API compatibility with Python lerobot - commands, terminology, and workflows must match identically
- **Serial API Separation**: Always use `serialport` package for Node.js and Web Serial API for browsers - never mix or bridge these incompatible APIs
- **Minimal Console Output**: Only show essential information - reduce cognitive load for users
- **Hardware-First Testing**: Always validate with real hardware, not just simulation
- **Library/Demo Separation**: Standard library handles hardware communication, demos handle storage/UI concerns - never mix these responsibilities
- **No Code Duplication**: Use shared utils, never reimplement the same functionality across files
- **Direct Library Usage**: End users call library functions directly (e.g., `calibrate()`, `teleoperate()`) - avoid unnecessary abstraction layers
- **Comments**: Write about the functionality, not what you did. We only need to know what the code is doing to make it more easy to understand, not a history of the changes
- **No Reference Comments**: Never write comments like "same pattern as calibrate.ts", "matches Node.js", "copied from X", etc. Comments should explain what the code does, not where it came from or what it's similar to
- **ABSOLUTELY FORBIDDEN: No Change Explanation Comments**: NEVER EVER add comments explaining what you changed, what's new, what's updated, or why you removed something. This is a standard library - there is no "new API", no "old way", no "updated approach". Just code that does what it does. Examples of STRICTLY FORBIDDEN comments:

  - `// Create teleoperation process using new API`
  - `// Updated API to match Node.js`
  - `// New extensible architecture`
  - `// Breaking change from old API`
  - `// React import not needed with modern JSX transform`
  - `// Removed unused import`
  - `// Note: Connection manager registration removed for build compatibility`
  - `// Card components not needed in this file`
  - `// SerialPortRequestOptions unused in current implementation`

  **VIOLATION OF THIS RULE IS NOT TOLERATED.** Just make the change cleanly without explaining it in comments. If you catch yourself writing "new", "old", "updated", "changed", "removed", "added" in a comment - DELETE IT.

## Project Goals

### Primary Objectives

1. **Native JavaScript/TypeScript Implementation**: Complete robotics stack running purely in JS/TS
2. **Feature Parity**: Implement core functionality from the original Python lerobot
3. **Web-First Design**: Enable robotics applications to run in browsers, Edge devices, and Node.js
4. **Real-World Robot Control**: Direct hardware interface without Python bridge
5. **Hugging Face Integration**: Seamless model and dataset loading from HF Hub

### Core Features to Implement

- **Pretrained Models**: Load and run robotics policies (ACT, Diffusion, TDMPC, VQ-BeT)
- **Dataset Management**: LeRobotDataset format with HF Hub integration
- **Simulation Environments**: Browser-based robotics simulations
- **Real Robot Support**: Hardware interfaces for motors, cameras, sensors
- **Training Infrastructure**: Policy training and evaluation tools
- **Visualization Tools**: Dataset and robot state visualization

## Technical Foundation

### Core Stack

- **Runtime**: Node.js 18+ / Modern Browsers
- **Language**: TypeScript with strict type checking
- **Build Tool**: Vite (development and production builds)
- **Package Manager**: pnpm
- **Module System**: ES Modules
- **Target**: ES2020

## Architecture Principles

### 1. Platform-Appropriate Design Philosophy

**Each platform should leverage its strengths while maintaining core robotics compatibility**

#### Node.js: Python lerobot Faithfulness

- **Identical Commands**: `npx lerobot find-port` matches `python -m lerobot.find_port`
- **Same Terminology**: Use "MotorsBus", not "robot arms" - keep Python's exact wording
- **Matching Output**: Error messages, prompts, and flow identical to Python version
- **Familiar Workflows**: Python lerobot users should feel immediately at home
- **CLI Compatibility**: Direct migration path from Python CLI

> **Why for Node.js?** CLI users are already trained on Python lerobot. Node.js provides seamless migration to TypeScript without learning new patterns.

#### Web: Modern Robotics UX

- **Superior User Experience**: Leverage browser capabilities for better robotics interfaces
- **Real-time Visual Feedback**: Live motor position displays, progress indicators, interactive calibration
- **Professional Web UI**: Modern component libraries, responsive design, accessibility
- **Browser-Native Patterns**: Use web standards like dialogs, forms, notifications appropriately
- **Enhanced Workflows**: Improve upon CLI limitations with graphical interfaces

> **Why for Web?** Web platforms can provide significantly better UX than CLI tools. Users expect modern, intuitive interfaces when using browser applications.

#### Shared Core: Robotics Protocol Compatibility

- **Identical Hardware Communication**: Same motor protocols, timing, calibration algorithms
- **Compatible Data Formats**: Calibration files work across all platforms
- **Consistent Robotics Logic**: Motor control, kinematics, safety systems identical

### 2. Modular Design

```
lerobot/
├── common/
│   ├── datasets/     # Dataset loading and management
│   ├── envs/         # Simulation environments
│   ├── policies/     # AI policies and models
│   ├── devices/      # Hardware device interfaces
│   └── utils/        # Shared utilities
├── core/             # Core robotics primitives
├── node/             # Node.js-specific implementations
└── web/              # Browser-specific implementations
```

### 3. Platform Abstraction

- **Universal Core**: Platform-agnostic robotics logic
- **Web Adapters**: Browser-specific implementations (WebGL, WebAssembly, **Web Serial API**)
- **Node Adapters**: Node.js implementations (native modules, **serialport package**)

### 4. Serial Communication Standards (Critical)

**Serial communication must use platform-appropriate APIs - never mix or bridge:**

- **Node.js Platform**: ALWAYS use `serialport` package
  - Event-based: `port.on('data', callback)`
  - Programmatic port listing: `SerialPort.list()`
  - Direct system access: `new SerialPort({ path: 'COM4' })`
- **Web Platform**: ALWAYS use Web Serial API
  - Promise/Stream-based: `await reader.read()`
  - User permission required: `navigator.serial.requestPort()`
  - Browser security model: User must select port via dialog

**Why this matters:** The APIs are completely incompatible - different patterns, different capabilities, different security models. Mixing them leads to broken implementations.

### 5. Progressive Enhancement

- **Core Functionality**: Works everywhere (basic policy inference)
- **Enhanced Features**: Leverage platform capabilities (GPU acceleration, hardware access)
- **Premium Features**: Advanced capabilities (real-time training, complex simulations)

## Development Standards

### Code Style

- **Formatting**: Prettier with default settings
- **Linting**: ESLint with TypeScript recommended rules
- **Naming**:
  - camelCase for variables/functions
  - PascalCase for classes/types
  - snake_case for file names (following lerobot convention)
- **File Structure**: Feature-based organization with index.ts barrels

### TypeScript Standards

- **Strict Mode**: All strict compiler options enabled
- **Type Safety**: Prefer types over interfaces for data structures
- **Generics**: Use generics for reusable components
- **Error Handling**: Use Result<T, E> pattern for recoverable errors

### Implementation Philosophy

#### Node.js Development

- **Python First**: When in doubt, check how Python lerobot does it
- **Direct Ports**: Mirror Python implementation for CLI compatibility
- **User Expectations**: Maintain exact experience Python CLI users expect
- **Terminology Consistency**: Use Python lerobot's exact naming and messaging

#### Web Development

- **Hardware Logic First**: Reuse Node.js's proven robotics protocols and algorithms
- **UX Innovation**: Improve upon CLI limitations with modern web interfaces
- **User Expectations**: Provide intuitive, visual experiences that exceed CLI capabilities
- **Web Standards**: Follow browser conventions and accessibility guidelines

### Development Process

#### Node.js Process

- **Python Reference**: Always check Python lerobot implementation first
- **CLI Matching**: Test that commands, outputs, and workflows match exactly
- **User Story Validation**: Validate against real Python lerobot users

#### Web Process

- **Hardware Foundation**: Start with Node.js robotics logic as proven base
- **UX Enhancement**: Design interfaces that provide better experience than CLI
- **User Testing**: Validate with both robotics experts and general web users

### Testing Strategy

- **Unit Tests**: Vitest for individual functions and classes
- **Integration Tests**: Test component interactions
- **E2E Tests**: Playwright for full workflow testing
- **Hardware Tests**: Mock/stub hardware interfaces for CI
- **UX Compatibility Tests**: Verify outputs match Python version

## Package Structure

### NPM Package Name

- **Public Package**: `lerobot` (on npm)
- **Development Name**: `lerobot.js` (GitHub repository)

## Dependencies Strategy

### Core Dependencies

- **ML Inference**: ONNX.js for model execution (browser + Node.js)
- **Tensor Operations**: Custom lightweight tensor lib for data manipulation
- **Math**: Custom math utilities for robotics
- **Networking**: Fetch API (universal)
- **File I/O**: Platform-appropriate abstractions

### Optional Enhanced Dependencies

- **3D Graphics**: Three.js for simulation and visualization
- **Hardware**: Platform-specific libraries for device access
- **Development**: Vitest, ESLint, Prettier

## Platform-Specific Implementation

### Node.js Implementation (Python-Compatible Foundation)

**Node.js serves as our Python-compatible foundation - closest to original lerobot behavior**

#### Core Principles for Node.js

- **Direct Python Ports**: Mirror Python lerobot APIs and workflows exactly
- **System-Level Access**: Leverage Node.js's full system capabilities
- **Performance Priority**: Direct hardware access without browser security constraints
- **CLI Compatibility**: Commands should feel identical to Python lerobot CLI

#### Node.js Hardware Stack

- **Serial Communication**: `serialport` package for direct hardware access
- **Data Types**: Node.js Buffer API for binary communication
- **File System**: Direct fs access for calibration files and datasets
- **Port Discovery**: Programmatic port enumeration without user dialogs
- **Process Management**: Direct process control and system integration

### Web Implementation (Modern Robotics Interface)

**Web provides superior robotics UX by building on Node.js's proven hardware protocols**

#### Core Principles for Web

- **Hardware Protocol Reuse**: Leverage Node.js's proven motor communication and calibration algorithms
- **Superior User Experience**: Create intuitive, visual interfaces that surpass CLI limitations
- **Browser-Native Design**: Use modern web patterns, components, and interactions appropriately
- **Real-time Capabilities**: Provide live feedback and interactive control impossible in CLI
- **Professional Quality**: Match or exceed commercial robotics software interfaces

#### Critical Web-Specific Adaptations

##### 1. Serial Communication Adaptation

- **Foundation**: Reuse Node.js Feetech protocol timing and packet structures
- **API Translation**:

  ```typescript
  // Node.js (serialport)
  port.on("data", callback);

  // Web (Web Serial API)
  const reader = port.readable.getReader();
  const { value } = await reader.read();
  ```

- **Browser Constraints**: Promise-based instead of event-based, user permission required
- **Timing Differences**: 10ms write-to-read delays, different buffer management

##### 2. Data Type Adaptation

- **Node.js**: `Buffer` API for binary data
- **Web**: `Uint8Array` for browser compatibility
- **Translation Pattern**:

  ```typescript
  // Node.js
  const packet = Buffer.from([0xff, 0xff, motorId]);

  // Web
  const packet = new Uint8Array([0xff, 0xff, motorId]);
  ```

##### 3. Storage Strategy Adaptation

- **Node.js**: Direct file system access (`fs.writeFileSync`)
- **Web**: Browser storage APIs (`localStorage`, `IndexedDB`)
- **Device Persistence**:
  - **Node.js**: File-based device configs
  - **Web**: Hardware serial numbers + `WebUSB.getDevices()` for auto-restoration

##### 4. Device Discovery Adaptation

- **Node.js**: Programmatic port listing (`SerialPort.list()`)
- **Web**: User-initiated port selection (`navigator.serial.requestPort()`)
- **Auto-Reconnection**:
  - **Node.js**: Automatic based on saved port paths
  - **Web**: WebUSB device matching + Web Serial port restoration

##### 5. UI Framework Integration

- **Node.js**: CLI-based interaction (inquirer, chalk)
- **Web**: React components with direct library function usage
- **Critical Patterns**:
  - **Direct Library Usage**: Call `calibrate()`, `teleoperate()` directly in components
  - **Controlled Hardware Access**: Single controlled serial operation via refs
  - **Real-time Updates**: Hardware callbacks → React state updates
  - **Professional UI**: shadcn Dialog, Card, Button components for robotics interfaces
- **Architecture Pattern**:

  ```typescript
  // Direct library usage in components (NO custom hooks)
  function CalibrationPanel({ robot }) {
    const [calibrationState, setCalibrationState] = useState();
    const calibrationProcessRef = useRef(null);

    useEffect(() => {
      const initCalibration = async () => {
        const process = await calibrate(robot, {
          onLiveUpdate: setCalibrationState,
        });
        calibrationProcessRef.current = process;
      };
      initCalibration();
    }, [robot]);
  }
  ```

#### Web Implementation Blockers Solved

**These blockers were identified during SO-100 web calibration development:**

1. **Web Serial Communication Protocol**

   - **Issue**: Browser timing differs from Node.js serialport
   - **Solution**: Adapt Node.js Feetech patterns with Promise.race timeouts
   - **Pattern**: Reuse protocol logic, translate API calls

2. **React + Hardware Integration**

   - **Issue**: React lifecycle conflicts with hardware state
   - **Solution**: Controlled serial access, proper useCallback dependencies
   - **Pattern**: Hardware operations outside React render cycle

3. **Real-Time Hardware Display**

   - **Issue**: UI showing calculated values instead of live positions
   - **Solution**: Hardware callbacks pass current positions to React
   - **Pattern**: Hardware → callback → React state → UI update

4. **Browser Storage for Hardware**

   - **Issue**: Multiple localStorage keys causing state inconsistency (e.g., `lerobot-robot-{serial}`, `lerobot-calibration-{serial}`, `lerobot_calibration_{type}_{id}`)
   - **Solution**: Unified storage system with automatic migration from old formats
   - **Implementation**:

     ```typescript
     // Unified key format
     const key = `lerobotjs-${serialNumber}`

     // Unified data structure
     {
       device_info: { serialNumber, robotType, robotId, usbMetadata },
       calibration: { motor_data..., metadata: { timestamp, readCount } }
     }
     ```

   - **Auto-Migration**: Automatically consolidates scattered old keys into unified format
   - **Pattern**: Single source of truth per physical device

5. **Device Persistence Across Sessions**

   - **Issue**: Serial numbers lost on page reload
   - **Solution**: WebUSB `getDevices()` + automatic device restoration
   - **Pattern**: Hardware ID persistence without user re-permission

6. **Professional Hardware UI**
   - **Issue**: Browser alerts inappropriate for robotics interfaces
   - **Solution**: shadcn Dialog components with device information
   - **Pattern**: Professional component library for hardware control

### Hardware Implementation Lessons (Universal Patterns)

#### Critical Hardware Compatibility (Both Platforms)

#### Baudrate Configuration

- **Feetech Motors (SO-100)**: MUST use 1,000,000 baud to match Python lerobot
- **Python Reference**: `DEFAULT_BAUDRATE = 1_000_000` in Python lerobot codebase
- **Common Mistake**: Using 9600 baud causes "Read timeout" errors despite device connection
- **Verification**: Always test with real hardware - simulation won't catch baudrate issues

#### Console Output Philosophy

- **Minimal Cognitive Load**: Reduce console noise to absolute minimum
- **Silent Operations**: Connection, initialization, cleanup should be silent unless error occurs
- **Error-Only Logging**: Only show output when user needs to take action or when errors occur
- **Professional UX**: Robotics tools should have clean, distraction-free interfaces

#### Calibration Flow Matching

- **Python Behavior**: When user hits Enter during range recording, reading stops IMMEDIATELY
- **No Final Reads**: Never read motor positions after user completes calibration
- **User Expectation**: After Enter, user should be able to release robot (positions will change)
- **Flow Testing**: Always validate against Python lerobot's exact behavior

### Development Process Requirements

#### CLI Build Process

- **Critical**: After TypeScript changes, MUST run `pnpm run build` to update CLI
- **Global CLI**: `lerobot` command uses compiled `dist/` files, not source
- **Testing Flow**: Edit source → Build → Test CLI → Repeat
- **Common Mistake**: Testing source changes without rebuilding CLI

#### Hardware Testing Priority

- **Real Hardware Required**: Simulation cannot catch hardware-specific issues
- **Baudrate Validation**: Only real devices will reveal communication problems
- **User Flow Testing**: Test complete calibration workflows with actual hardware
- **Port Management**: Ensure proper port cleanup between testing sessions

### CRITICAL: Calibration Implementation Requirements

#### Calibration File Format (Learned from SO-100 Implementation)

- **NEVER use array-based format**: Calibration files must use motor names as keys, NOT arrays
- **Python-Compatible Structure**: Each motor must be an object with `id`, `drive_mode`, `homing_offset`, `range_min`, `range_max`
- **Wrong Format** (causes Python incompatibility):
  ```json
  {
    "homing_offset": [47, 1013, -957, ...],
    "drive_mode": [0, 0, 0, ...],
    "motor_names": ["shoulder_pan", ...]
  }
  ```
- **Correct Format** (Python-compatible):
  ```json
  {
    "shoulder_pan": {
      "id": 1,
      "drive_mode": 0,
      "homing_offset": 47,
      "range_min": 985,
      "range_max": 3085
    }
  }
  ```

#### Homing Offset Calibration Protocol (Critical for STS3215/Feetech Motors)

- **MUST Reset Existing Offsets**: Before calculating new homing offsets, ALWAYS reset existing homing offsets to 0
- **Python Reference**: Python's `set_half_turn_homings()` calls `reset_calibration()` first
- **Missing Reset Causes**: Completely wrong homing offset values (~1000+ unit differences)
- **Reset Protocol**: Write value 0 to Homing_Offset register (address 31) for each motor before reading positions
- **Verification**: Ensure reset commands receive successful responses before proceeding

#### STS3215 Sign-Magnitude Encoding

- **Homing_Offset Uses Special Encoding**: Bit 11 is sign bit, lower 11 bits are magnitude
- **Position Reads**: Some registers may need sign-magnitude decoding - verify against Python behavior
- **Encoding Functions**: Implement `encodeSignMagnitude()` and `decodeSignMagnitude()` for protocol compatibility
- **Common Symptom**: Values differing by ~2048 or ~4096 indicate sign-magnitude encoding issues

#### Calibration Process Validation

- **Same Neutral Position**: When comparing calibrations, ensure robot is in identical physical position
- **Expected Accuracy**: Properly implemented calibration should match Python within 30 units
- **Debug Protocol**: Log position values, reset confirmations, and calculation steps for troubleshooting
- **Range Verification**: `wrist_roll` should always use full range (0-4095), other motors use recorded ranges

#### Common Calibration Mistakes to Avoid

1. **Skipping Homing Reset**: Leads to ~1000+ unit differences in homing offsets
2. **Array-Based File Format**: Makes calibration files incompatible with Python lerobot
3. **Ignoring Sign-Magnitude Encoding**: Causes specific motors (often wrist_roll) to have wrong values
4. **Different Physical Positions**: Comparing calibrations done at different robot positions
5. **Missing Motor ID Assignment**: Forgetting to assign correct motor IDs (1-6 for SO-100)

#### Device-Agnostic Calibration Architecture

- **No Hardcoded Device Values**: Calibration logic must be configurable for different robot types
- **Configuration-Driven Protocol**: Motor IDs, register addresses, resolution, etc. should come from device config
- **Extensible Design**: Adding new robot types should only require new config files, not core logic changes
- **Example Bad Practice**: Hardcoding `const motorIds = [1,2,3,4,5,6]` in calibration logic
- **Example Good Practice**: Using `config.motorIds` from device-specific configuration
- **Protocol Abstraction**: Register addresses, resolution, encoding details should be configurable per device type

#### CRITICAL: Calibration Sequence and Hardware State Management

**The exact sequence of calibration operations is critical for Python compatibility. Getting this wrong causes major range/offset discrepancies.**

##### The Correct Calibration Sequence (Matching Python Exactly)

1. **Reset Existing Homing Offsets to 0**: Write 0 to all Homing_Offset registers
2. **Read Physical Positions**: Get actual motor positions (will be raw, non-centered values)
3. **Calculate New Homing Offsets**: `offset = position - (resolution-1)/2`
4. **IMMEDIATELY Write Homing Offsets**: Write new offsets to motor registers **before range recording**
5. **Read Positions for Range Init**: Now positions will appear centered (~2047) due to applied offsets
6. **Record Range of Motion**: Use centered positions as starting min/max values
7. **Write Hardware Position Limits**: Write `range_min`/`range_max` to motor limit registers

##### Critical Implementation Details

**Homing Offset Writing Must Be Immediate:**

```typescript
// WRONG - Only calculates, doesn't write to motors
async function setHomingOffsets(config) {
  const positions = await readMotorPositions(config);
  const offsets = calculateOffsets(positions);
  return offsets; // ❌ Not written to motors!
}

// CORRECT - Writes offsets to motors immediately
async function setHomingOffsets(config) {
  await resetHomingOffsets(config); // Reset first
  const positions = await readMotorPositions(config);
  const offsets = calculateOffsets(positions);
  await writeHomingOffsetsToMotors(config, offsets); // ✅ Written immediately
  return offsets;
}
```

**Range Recording Initialization Must Read Actual Positions:**

```typescript
// WRONG - Hardcoded center values
const rangeMins = {};
const rangeMaxes = {};
for (const motor of motors) {
  rangeMins[motor] = 2047; // ❌ Hardcoded!
  rangeMaxes[motor] = 2047;
}

// CORRECT - Read actual positions (now centered due to applied homing offsets)
const startPositions = await readMotorPositions(config);
const rangeMins = {};
const rangeMaxes = {};
for (let i = 0; i < motors.length; i++) {
  rangeMins[motors[i]] = startPositions[i]; // ✅ Uses actual values
  rangeMaxes[motors[i]] = startPositions[i];
}
```

**Hardware Position Limits Must Be Written:**

```typescript
// Python writes these registers, so we must too
await writeMotorRegister(config, motorId, MIN_POSITION_LIMIT_ADDR, range_min);
await writeMotorRegister(config, motorId, MAX_POSITION_LIMIT_ADDR, range_max);
```

##### Why This Sequence Matters

**Problem**: User moves robot to same physical position, but Python shows ~2047 and Node.js shows wildly different values (3013, 1200, etc.)

**Root Cause**: Python applies homing offsets immediately, making subsequent position reads appear centered. Node.js was calculating offsets but not applying them, so position reads remained raw.

**Evidence of Correct Implementation**: After fixing the sequence, Node.js and Python both show ~2047 for the same physical position, and final calibration ranges match within professional tolerances (±50 units).

##### Register Addresses for STS3215 Motors

```typescript
const STS3215_REGISTERS = {
  Present_Position: { address: 56, length: 2 },
  Homing_Offset: { address: 31, length: 2 }, // Sign-magnitude encoded
  Min_Position_Limit: { address: 9, length: 2 },
  Max_Position_Limit: { address: 11, length: 2 },
};
```

##### Common Sequence Mistakes That Cause Major Issues

1. **Not Writing Homing Offsets**: Calculates but doesn't apply → position reads remain raw → wrong range initialization
2. **Hardcoded Range Initialization**: Forces 2047 instead of reading actual positions → doesn't match Python behavior
3. **Missing Hardware Limit Writing**: Python constrains motors, Node.js doesn't → different range recording behavior
4. **Wrong Reset Timing**: Not resetting existing offsets first → accumulated offset errors
5. **Skipping Intermediate Delays**: Not waiting for motor register writes to take effect → inconsistent state

**This sequence debugging took extensive analysis to solve. Future implementations MUST follow this exact pattern to maintain Python compatibility.**

#### CRITICAL: Smooth Motor Control Recipe (PROVEN WORKING)

**These patterns provide buttery-smooth, responsive motor control. Deviating from this recipe causes stuttering, lag, or poor responsiveness.**

##### 🚀 Performance Optimizations (KEEP THESE!)

**1. Optimal Step Size**

- **✅ PERFECT**: `25` units per keypress (responsive but not jumpy)
- **❌ WRONG**: `5` units (too sluggish) or `100` units (too aggressive)

**2. Minimal Motor Communication Delay**

- **✅ PERFECT**: `1ms` delay between motor commands
- **❌ WRONG**: `5ms+` delays cause stuttering

**3. Smart Motor Updates (CRITICAL FOR SMOOTHNESS)**

- **✅ PERFECT**: Only send commands for motors that actually changed
- **✅ PERFECT**: Use `0.5` unit threshold to detect meaningful changes
- **❌ WRONG**: Send ALL motor positions every time (causes serial bus conflicts)

**4. Change Detection Threshold**

- **✅ PERFECT**: `0.5` units prevents micro-movements and unnecessary commands
- **❌ WRONG**: `0.1` units (too sensitive) or no threshold (constant spam)

##### 🎯 Teleoperation Loop Best Practices

**1. Eliminate Display Spam**

- **✅ PERFECT**: Minimal loop with just duration checks and 100ms delay
- **❌ WRONG**: Constant position reading and display updates (causes 90ms+ lag)

**2. Event-Driven Keyboard Input**

- **✅ PERFECT**: Use `process.stdin.on("data")` for immediate response
- **❌ WRONG**: Polling-based input with timers (adds delay)

##### 🔧 Hardware Communication Patterns

**1. Discrete Step-Based Control**

- **✅ PERFECT**: Immediate position updates on keypress
- **❌ WRONG**: Continuous/velocity-based control (causes complexity and lag)

**2. Direct Motor Position Writing**

- **✅ PERFECT**: Simple, immediate motor updates with position limits
- **❌ WRONG**: Complex interpolation, target positions, multiple update cycles

##### 🎮 Proven Working Values

**Key Configuration Values:**

- `stepSize = 25` (default in teleoperate.ts and keyboard_teleop.ts)
- `1ms` motor communication delay (so100_follower.ts)
- `0.5` unit change detection threshold
- `100ms` teleoperation loop delay

##### ⚠️ Performance Killers (NEVER DO THESE)

1. **❌ Display Updates in Main Loop**: Causes 90ms+ loop times
2. **❌ Continuous/Velocity Control**: Adds complexity without benefit for keyboard input
3. **❌ All-Motor Updates**: Sends unnecessary commands, overwhelms serial bus
4. **❌ Long Communication Delays**: 5ms+ delays cause stuttering
5. **❌ Complex Interpolation**: Adds latency for simple step-based control
6. **❌ No Change Detection**: Spams motors with identical positions

##### 📊 Performance Metrics (When It's Working Right)

- **Keypress Response**: Immediate (< 10ms)
- **Motor Update**: Single command per changed motor
- **Loop Time**: < 5ms (when not reading positions)
- **User Experience**: "Buttery smooth", "fucking working and super perfect"

**Golden Rule**: When you achieve smooth control, NEVER change the step size, delays, or update patterns without extensive testing. These values were optimized through real hardware testing.

## Clean Library Architecture (Critical Lessons)

### Standard Library Design Principles

**End users should be able to use the library with minimal effort and excellent UX:**

```typescript
// ✅ PERFECT: Clean, self-contained library functions
const calibrationProcess = await calibrate(robotConnection, options);
const result = await calibrationProcess.result;

const teleoperationProcess = await teleoperate(robotConnection, options);
teleoperationProcess.start();
```

**❌ WRONG: Custom hooks and abstraction layers**

```typescript
// Never create hooks like useTeleoperation, useCalibration
// End users shouldn't need React to use robotics functions
```

### Library vs Demo Separation (CRITICAL)

**Library Responsibilities:**

- Hardware communication protocols
- Robot control logic
- Calibration algorithms
- Motor communication utilities
- Device-agnostic interfaces

**Demo Responsibilities:**

- localStorage/storage management
- UI state management
- JSON file export/import
- User interface components
- Application-specific workflows

**❌ WRONG: Mixing concerns**

```typescript
// NEVER put localStorage in standard library
export function teleoperate(robot, options) {
  const calibration = localStorage.getItem("calibration"); // ❌ Demo concern in library
}
```

**✅ CORRECT: Clean separation**

```typescript
// Library: Pure hardware function
export function teleoperate(robot, options) {
  // options.calibrationData passed from demo
}

// Demo: Handles storage
const calibrationData = getUnifiedRobotData(robot.serialNumber)?.calibration;
const process = await teleoperate(robot, { calibrationData });
```

### Utils Structure (No Code Duplication)

**Proper utils organization prevents reimplementation:**

```
src/lerobot/web/utils/
├── sts3215-protocol.ts     # Protocol constants
├── sign-magnitude.ts       # Encoding/decoding
├── serial-port-wrapper.ts  # Web Serial wrapper
├── motor-communication.ts  # Core motor operations
└── motor-calibration.ts    # Calibration functions
```

**❌ WRONG: Duplicate implementations**

- Multiple files with same motor communication code
- Calibration logic copied across files
- Protocol constants scattered everywhere

**✅ CORRECT: Single source of truth**

- Shared utilities with clear responsibilities
- Import from utils, never reimplement
- Kebab-case naming for consistency

### Types Organization

**Types belong in dedicated directories, not mixed with business logic:**

```
src/lerobot/web/types/
├── robot-connection.ts     # Core connection types
└── robot-config.ts        # Hardware configuration types
```

**❌ WRONG: Types in business logic files**

```typescript
// Never export types from find_port.ts, calibrate.ts, etc.
import type { RobotConnection } from "./find_port.js"; // ❌ Bad architecture
```

**✅ CORRECT: Proper type imports**

```typescript
import type { RobotConnection } from "./types/robot-connection.js"; // ✅ Clean
```

### Device-Agnostic Architecture

**Standard library must support multiple robot types without hardcoding:**

**✅ CORRECT: Configuration-driven**

```typescript
// Generic library function
export async function teleoperate(robotConnection, options) {
  const config = createRobotConfig(robotConnection.robotType); // Device-specific
  // ... generic logic using config
}

// Device-specific configuration
export function createSO100Config(type) {
  return {
    motorIds: [1, 2, 3, 4, 5, 6],
    keyboardControls: SO100_KEYBOARD_CONTROLS,
    // ... other device specifics
  };
}
```

**❌ WRONG: Hardcoded device values**

```typescript
// Never hardcode in generic library
const KEYBOARD_CONTROLS = { w: "elbow_flex" }; // ❌ SO-100 specific in generic code
```

### Browser Keyboard Timing (Critical for Teleoperation)

**Browser keyboard repeat pattern:**

1. Initial keydown → immediate
2. ~500ms delay (browser default)
3. Rapid repeating

**✅ CORRECT: Account for browser delays**

```typescript
private readonly KEY_TIMEOUT = 600; // ms - longer than browser repeat delay
```

**❌ WRONG: Too short timeout**

```typescript
private readonly KEY_TIMEOUT = 100; // ❌ Causes pause during browser repeat delay
```

### State Update Callbacks (UI Responsiveness)

**Library must notify UI of state changes, especially when stopping:**

**✅ CORRECT: Always notify on state changes**

```typescript
stop(): void {
  this.isActive = false;
  // ... cleanup ...

  // CRITICAL: Notify UI immediately
  if (this.onStateUpdate) {
    this.onStateUpdate(this.getState());
  }
}
```

### Component Architecture (No Custom Hardware Hooks)

**Use library functions directly in components, just like calibration:**

**✅ CORRECT: Direct library usage**

```typescript
// In component
const [teleoperationState, setTeleoperationState] =
  useState<TeleoperationState>();
const teleoperationProcessRef = useRef<TeleoperationProcess | null>(null);

useEffect(() => {
  const initTeleoperation = async () => {
    const process = await teleoperate(robot, {
      onStateUpdate: setTeleoperationState,
    });
    teleoperationProcessRef.current = process;
  };
  initTeleoperation();
}, [robot]);
```

**❌ WRONG: Custom hooks**

```typescript
// Never create these - adds unnecessary complexity
const { start, stop, motorConfigs } = useTeleoperation(robot);
const { startCalibration, isActive } = useCalibration(robot);
```

### Architecture Success Metrics

**When architecture is correct:**

- ✅ End users can use library functions directly without React
- ✅ Adding new robot types requires zero changes to existing code
- ✅ Demo and library have zero shared dependencies
- ✅ No code duplication across files
- ✅ Types are properly organized and importable
- ✅ UI updates immediately reflect hardware state changes

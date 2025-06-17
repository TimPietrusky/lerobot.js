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

### 1. Python lerobot Faithfulness (Primary Principle)

**lerobot.js must maintain UX/API compatibility with Python lerobot**

- **Identical Commands**: `npx lerobot find-port` matches `python -m lerobot.find_port`
- **Same Terminology**: Use "MotorsBus", not "robot arms" - keep Python's exact wording
- **Matching Output**: Error messages, prompts, and flow identical to Python version
- **Familiar Workflows**: Python lerobot users should feel immediately at home
- **No "Improvements"**: Resist urge to add features/UX that Python version doesn't have

> **Why?** Users are already trained on Python lerobot. Our goal is seamless migration to TypeScript, not learning a new tool.

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

- **Python First**: When in doubt, check how Python lerobot does it
- **Port, Don't Innovate**: Direct ports are better than clever improvements
- **User Expectations**: Maintain the exact experience Python users expect
- **Terminology Consistency**: Use Python lerobot's exact naming and messaging

### Development Process

- **Python Reference**: Always check Python lerobot implementation first
- **UX Matching**: Test that commands, outputs, and workflows match exactly
- **User Story Validation**: Validate against real Python lerobot users

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

## Hardware Implementation Lessons

### Critical Hardware Compatibility

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

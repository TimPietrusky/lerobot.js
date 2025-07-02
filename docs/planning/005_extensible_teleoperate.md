# User Story 005: Extensible Teleoperation Architecture

## Story

**As a** robotics developer building teleoperation systems with various input devices  
**I want** to use different teleoperators (keyboard, leader arms, joysticks, VR controllers) to control my robot arms  
**So that** I can choose the most appropriate control method for my application without being locked into keyboard-only control

## Background

The current Web teleoperation implementation has keyboard controls hardcoded into the `WebTeleoperationController`, making it impossible to use other input devices like leader arms, joysticks, or future control methods. Meanwhile, the Node.js implementation already has the correct extensible architecture with pluggable teleoperators.

This architectural inconsistency creates several problems:

- **Limited Extensibility**: Web users cannot use leader arms or other advanced teleoperators
- **API Mismatch**: Web API `teleoperate(robotConnection, options)` differs from Node.js API `teleoperate(config: TeleoperateConfig)`
- **Hardcoded Assumptions**: Keyboard logic is baked into the core teleoperation controller
- **Future Limitations**: Adding new input devices requires core architecture changes

The Python lerobot and Node.js lerobot.js both follow a proper separation where:

- **Robots** handle motor communication and hardware control
- **Teleoperators** handle input device reading and command generation
- **Teleoperation orchestrator** connects teleoperators to robots

We need to refactor the Web implementation to match this proven architecture, enabling seamless extension to leader arms, joysticks, VR controllers, and other future input devices.

## Acceptance Criteria

### Core Functionality

- [ ] **Pluggable Teleoperators**: Support multiple teleoperator types (keyboard, leader arms, etc.)
- [ ] **API Alignment**: Web API matches Node.js: `teleoperate(config: TeleoperateConfig)`
- [ ] **Keyboard Teleoperator**: Extract existing keyboard logic into dedicated teleoperator class
- [ ] **Teleoperator Abstraction**: Base interface that all teleoperators implement
- [ ] **Type Safety**: Each teleoperator type has its own configuration interface
- [ ] **State Management**: Maintain current TeleoperationState approach with teleoperator-specific extensions

### User Experience

- [ ] **Breaking Change**: Clean API break - no backward compatibility with old hardcoded approach
- [ ] **Consistent Interface**: Same teleoperation process object regardless of teleoperator type
- [ ] **Future-Ready**: Easy addition of new teleoperator types without core changes
- [ ] **Error Handling**: Clear error messages for unsupported or misconfigured teleoperators

### Technical Requirements

- [ ] **Architecture Separation**: Clear separation between robot control and teleoperator input
- [ ] **Web Implementation**: Focus on Web platform to match Node.js architecture
- [ ] **TypeScript**: Fully typed with union types for teleoperator configurations
- [ ] **No Code Duplication**: Reuse existing motor communication and robot control logic
- [ ] **Configuration-Driven**: Teleoperator behavior determined by config, not hardcoded logic

## Expected User Flow

### Keyboard Teleoperation (Current Functionality Preserved)

```typescript
import { teleoperate } from "lerobot/web/teleoperate";

// New API - explicitly specify teleoperator
const teleoperationProcess = await teleoperate({
  robot: {
    type: "so100_follower",
    port: selectedPort,
    // ... existing robot config
  },
  teleop: {
    type: "keyboard",
    stepSize: 25,
    updateRate: 60,
  },
  calibrationData: loadedCalibrationData,
  onStateUpdate: (state) => {
    // Update UI with current state
    console.log("Robot positions:", state.motorConfigs);
    console.log("Active keys:", state.keyStates);
  },
});

// Same process interface as before
teleoperationProcess.start();
teleoperationProcess.updateKeyState("ArrowUp", true);
teleoperationProcess.stop();
```

### Leader Arm Teleoperation (Future)

```typescript
// Future leader arm teleoperator
const teleoperationProcess = await teleoperate({
  robot: {
    type: "so100_follower",
    port: followerPort,
  },
  teleop: {
    type: "so100_leader",
    port: leaderPort,
    calibrationData: leaderCalibration,
    positionSmoothing: true,
  },
  calibrationData: followerCalibration,
  onStateUpdate: (state) => {
    console.log("Follower positions:", state.motorConfigs);
    console.log("Leader positions:", state.leaderPositions);
  },
});

teleoperationProcess.start(); // Reads from leader, writes to follower
```

### Direct Motor Control

```typescript
import { teleoperate, DirectTeleoperator } from "@lerobot/web";

// Direct motor control for programmatic use (sliders, API calls)
const teleoperationProcess = await teleoperate({
  robot: {
    type: "so100_follower",
    port: robotPort,
  },
  teleop: {
    type: "direct",
  },
  calibrationData: calibrationData,
  onStateUpdate: (state) => {
    console.log("Robot positions:", state.motorConfigs);
  },
});

// Control motors programmatically
teleoperationProcess.start();
const directTeleoperator =
  teleoperationProcess.teleoperator as DirectTeleoperator;
await directTeleoperator.moveMotor("shoulder_pan", 2500);
await directTeleoperator.setMotorPositions({
  shoulder_lift: 1800,
  gripper: 3000,
});
```

### Joystick Teleoperation (Future)

```typescript
// Future joystick teleoperator
const teleoperationProcess = await teleoperate({
  robot: {
    type: "so100_follower",
    port: robotPort,
  },
  teleop: {
    type: "gamepad",
    controllerIndex: 0,
    axisMapping: {
      leftStick: "shoulder_pan",
      rightStick: "shoulder_lift",
      triggers: "gripper",
    },
  },
  calibrationData: calibrationData,
});
```

### Error Handling

```typescript
// Unsupported teleoperator type
try {
  await teleoperate({
    robot: { type: "so100_follower", port: "COM4" },
    teleop: { type: "unsupported_device" },
  });
} catch (error) {
  console.error("Error: Unsupported teleoperator type: unsupported_device");
  console.error("Supported types: keyboard, so100_leader");
}
```

## Implementation Details

### File Structure

```
packages/web/src/
├── teleoperate.ts                    # Updated main API (breaking change)
├── teleoperators/
│   ├── base-teleoperator.ts          # Base teleoperator interface
│   ├── keyboard-teleoperator.ts      # Extracted keyboard logic
│   ├── index.ts                      # Barrel exports
│   └── [future]
│       ├── leader-arm-teleoperator.ts
│       ├── gamepad-teleoperator.ts
│       └── vr-teleoperator.ts
└── types/
    └── teleoperation.ts              # Updated with teleoperator config types
```

### Key Dependencies

#### No New Dependencies

- **Existing**: Reuse all current Web dependencies (Web Serial API, motor communication utils)
- **Architecture Only**: This is purely an architectural refactor - no new external dependencies

### Core Functions to Implement

#### Updated API (Breaking Change)

```typescript
// teleoperate.ts - New API matching Node.js
interface TeleoperateConfig {
  robot: RobotConnection;
  teleop: TeleoperatorConfig;
  calibrationData?: { [motorName: string]: any };
  onStateUpdate?: (state: TeleoperationState) => void;
}

// Union type for all teleoperator configurations
type TeleoperatorConfig =
  | KeyboardTeleoperatorConfig
  | LeaderArmTeleoperatorConfig
  | GamepadTeleoperatorConfig;

// Main function - breaking change from old API
async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess>;
```

#### Teleoperator Configuration Types

```typescript
// Base interface all teleoperators implement
interface BaseTeleoperatorConfig {
  type: string;
}

// Keyboard teleoperator configuration
interface KeyboardTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "keyboard";
  stepSize?: number; // Default: 25
  updateRate?: number; // Default: 60 (FPS)
  keyTimeout?: number; // Default: 10000ms
}

// Future: Leader arm teleoperator configuration
interface LeaderArmTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "so100_leader";
  port: string;
  calibrationData?: any;
  positionSmoothing?: boolean;
  scaleFactor?: number;
}

// Future: Gamepad teleoperator configuration
interface GamepadTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "gamepad";
  controllerIndex?: number;
  axisMapping?: { [axis: string]: string };
  deadzone?: number;
}
```

#### Base Teleoperator Interface

```typescript
// base-teleoperator.ts
interface WebTeleoperator {
  // Lifecycle management
  initialize(robotConnection: RobotConnection): Promise<void>;
  start(): void;
  stop(): void;
  disconnect(): Promise<void>;

  // State management
  getState(): TeleoperatorSpecificState;

  // Robot interaction
  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void;
}

// Base class with common functionality
abstract class BaseWebTeleoperator implements WebTeleoperator {
  protected port: MotorCommunicationPort;
  protected motorConfigs: MotorConfig[] = [];
  protected isActive: boolean = false;
  protected onStateUpdate?: (state: TeleoperationState) => void;

  constructor(
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    onStateUpdate?: (state: TeleoperationState) => void
  ) {
    this.port = port;
    this.motorConfigs = motorConfigs;
    this.onStateUpdate = onStateUpdate;
  }

  abstract initialize(): Promise<void>;
  abstract start(): void;
  abstract stop(): void;
  abstract getState(): TeleoperatorSpecificState;

  async disconnect(): Promise<void> {
    this.stop();
  }

  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void {
    this.motorConfigs = motorConfigs;
  }
}
```

#### Keyboard Teleoperator (Extracted Logic)

```typescript
// keyboard-teleoperator.ts - Extract from current WebTeleoperationController
class KeyboardTeleoperator extends BaseWebTeleoperator {
  private keyboardControls: { [key: string]: KeyboardControl } = {};
  private updateInterval: NodeJS.Timeout | null = null;
  private keyStates: {
    [key: string]: { pressed: boolean; timestamp: number };
  } = {};

  // Configuration from KeyboardTeleoperatorConfig
  private readonly stepSize: number;
  private readonly updateRate: number;
  private readonly keyTimeout: number;

  constructor(
    config: KeyboardTeleoperatorConfig,
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    keyboardControls: { [key: string]: KeyboardControl },
    onStateUpdate?: (state: TeleoperationState) => void
  ) {
    super(port, motorConfigs, onStateUpdate);
    this.keyboardControls = keyboardControls;

    // Extract configuration
    this.stepSize = config.stepSize ?? 25;
    this.updateRate = config.updateRate ?? 60;
    this.keyTimeout = config.keyTimeout ?? 10000;
  }

  async initialize(): Promise<void> {
    // Move existing initialization logic here
    for (const config of this.motorConfigs) {
      const position = await readMotorPosition(this.port, config.id);
      if (position !== null) {
        config.currentPosition = position;
      }
    }
  }

  start(): void {
    // Move existing start logic here
    if (this.isActive) return;

    this.isActive = true;
    this.updateInterval = setInterval(() => {
      this.updateMotorPositions();
    }, 1000 / this.updateRate);
  }

  stop(): void {
    // Move existing stop logic here
    if (!this.isActive) return;

    this.isActive = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.keyStates = {};

    if (this.onStateUpdate) {
      this.onStateUpdate(this.buildTeleoperationState());
    }
  }

  updateKeyState(key: string, pressed: boolean): void {
    this.keyStates[key] = { pressed, timestamp: Date.now() };
  }

  getState(): KeyboardTeleoperatorState {
    return {
      keyStates: { ...this.keyStates },
    };
  }

  private buildTeleoperationState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorConfigs: [...this.motorConfigs],
      lastUpdate: Date.now(),
      keyStates: { ...this.keyStates },
    };
  }

  private updateMotorPositions(): void {
    // Move existing updateMotorPositions logic here
    // ... (existing keyboard processing logic)
  }
}
```

#### Teleoperator Factory

```typescript
// teleoperate.ts - Factory pattern
async function createTeleoperator(
  config: TeleoperateConfig,
  port: MotorCommunicationPort,
  motorConfigs: MotorConfig[],
  robotHardwareConfig: RobotHardwareConfig
): Promise<WebTeleoperator> {
  switch (config.teleop.type) {
    case "keyboard":
      return new KeyboardTeleoperator(
        config.teleop,
        port,
        motorConfigs,
        robotHardwareConfig.keyboardControls,
        config.onStateUpdate
      );

    case "so100_leader":
      // Future implementation
      throw new Error("Leader arm teleoperator not yet implemented");

    case "gamepad":
      // Future implementation
      throw new Error("Gamepad teleoperator not yet implemented");

    default:
      throw new Error(
        `Unsupported teleoperator type: ${(config.teleop as any).type}`
      );
  }
}
```

#### Updated Main Teleoperate Function

```typescript
// teleoperate.ts - Updated main function (breaking change)
export async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess> {
  // Validate required fields
  if (!config.robot.robotType) {
    throw new Error(
      "Robot type is required for teleoperation. Please configure the robot first."
    );
  }

  // Create web serial port wrapper (same as before)
  const port = new WebSerialPortWrapper(config.robot.port);
  await port.initialize();

  // Get robot-specific configuration (same as before)
  let robotHardwareConfig: RobotHardwareConfig;
  if (config.robot.robotType.startsWith("so100")) {
    robotHardwareConfig = createSO100Config(config.robot.robotType);
  } else {
    throw new Error(`Unsupported robot type: ${config.robot.robotType}`);
  }

  // Create motor configs (same as before)
  const defaultMotorConfigs =
    createMotorConfigsFromRobotConfig(robotHardwareConfig);
  const motorConfigs = config.calibrationData
    ? applyCalibrationToMotorConfigs(
        defaultMotorConfigs,
        config.calibrationData
      )
    : defaultMotorConfigs;

  // Create teleoperator using factory pattern (NEW)
  const teleoperator = await createTeleoperator(
    config,
    port,
    motorConfigs,
    robotHardwareConfig
  );
  await teleoperator.initialize();

  // Return process object (same interface as before)
  return {
    start: () => {
      teleoperator.start();
      // State update loop (same as before)
      if (config.onStateUpdate) {
        const updateLoop = () => {
          if (teleoperator.getState()) {
            config.onStateUpdate!(
              buildTeleoperationStateFromTeleoperator(teleoperator)
            );
            setTimeout(updateLoop, 100);
          }
        };
        updateLoop();
      }
    },
    stop: () => teleoperator.stop(),
    updateKeyState: (key: string, pressed: boolean) => {
      // Delegate to teleoperator if it supports keyboard input
      if (teleoperator instanceof KeyboardTeleoperator) {
        teleoperator.updateKeyState(key, pressed);
      }
    },
    getState: () => buildTeleoperationStateFromTeleoperator(teleoperator),
    moveMotor: async (motorName: string, position: number) => {
      // Direct motor control through teleoperator
      if (teleoperator instanceof DirectTeleoperator) {
        return teleoperator.moveMotor(motorName, position);
      }
      throw new Error(
        `Motor control not supported for ${config.teleop.type} teleoperator`
      );
    },
    setMotorPositions: async (positions: { [motorName: string]: number }) => {
      // Direct motor control through teleoperator
      if (teleoperator instanceof DirectTeleoperator) {
        return teleoperator.setMotorPositions(positions);
      }
      throw new Error(
        `Motor control not supported for ${config.teleop.type} teleoperator`
      );
    },
    disconnect: () => teleoperator.disconnect(),
  };
}
```

### Technical Considerations

#### State Management Strategy

Maintain current `TeleoperationState` structure but extend with teleoperator-specific state:

```typescript
interface TeleoperationState {
  isActive: boolean;
  motorConfigs: MotorConfig[];
  lastUpdate: number;

  // Teleoperator-specific state (optional fields for different types)
  keyStates?: { [key: string]: { pressed: boolean; timestamp: number } }; // keyboard
  leaderPositions?: { [motor: string]: number }; // leader arm
  gamepadState?: { axes: number[]; buttons: boolean[] }; // gamepad
}
```

#### Migration Strategy

**Breaking Change Approach:**

1. **Remove old API** - No backward compatibility
2. **Update examples** - All demo applications must be updated to use new API
3. **Clear documentation** - Document the API change and migration path
4. **Type safety** - TypeScript will catch all usages of old API

#### Future Extensibility

The architecture supports easy addition of new teleoperators:

```typescript
// Future: Add VR controller
interface VRTeleoperatorConfig extends BaseTeleoperatorConfig {
  type: "vr_controller";
  handedness: "left" | "right";
  trackingSpace: "local" | "world";
}

class VRTeleoperator extends BaseWebTeleoperator {
  // VR-specific implementation
}

// Add to factory in teleoperate.ts
case "vr_controller":
  return new VRTeleoperator(config.teleop, port, motorConfigs, config.onStateUpdate);
```

#### Performance Considerations

- **Same Performance**: No performance impact - just architectural refactoring
- **Memory Usage**: Slightly lower memory usage due to cleaner separation
- **Extensibility**: No overhead for unused teleoperator types

## Definition of Done

- [ ] **API Breaking Change**: Web API updated to `teleoperate(config: TeleoperateConfig)` matching Node.js
- [ ] **Keyboard Teleoperator**: Existing keyboard functionality extracted into `KeyboardTeleoperator` class
- [ ] **Base Teleoperator**: `BaseWebTeleoperator` abstract class with common functionality
- [ ] **Teleoperator Factory**: Factory pattern for creating appropriate teleoperator instances
- [ ] **Type Safety**: Full TypeScript coverage with union types for teleoperator configurations
- [ ] **State Management**: Current `TeleoperationState` approach preserved with teleoperator extensions
- [ ] **Process Interface**: `TeleoperationProcess` interface remains the same for existing UI code
- [ ] **Error Handling**: Clear error messages for unsupported teleoperator types
- [ ] **No Regression**: Keyboard teleoperation functionality identical to current implementation
- [ ] **Future Ready**: Architecture supports easy addition of leader arms, joysticks, VR controllers
- [ ] **Code Quality**: No code duplication, clean separation of concerns
- [ ] **Documentation**: Updated examples and documentation for new API

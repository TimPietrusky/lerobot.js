# User Story 005: Building Block API - Clean, Composable, Unified

## 🎯 Goal

Create a clean building block API across Python lerobot, Node.js lerobot.js, and Web lerobot.js where users manage state and workflow while we abstract away robotics complexity. Users learn core concepts once and apply them everywhere.

## 🚨 Problem Statement

Currently, the APIs have fundamentally different approaches:

### Current Inconsistencies

1. **State Management**:
   - Python/Node.js: Functions handle connection lifecycle internally
   - Web: User must manually manage controllers and connections
2. **Complexity Exposure**:
   - Python/Node.js: `calibrate(config)` - single call does everything
   - Web: Multi-step `controller.performHomingStep()`, `controller.moveToPosition()`, etc.
3. **Resource Management**:
   - Python/Node.js: Each function connects/disconnects automatically
   - Web: User manages port lifecycle manually
4. **Device Identification**:
   - Node.js: Port discovery finds system ports by name (COM4, /dev/ttyUSB0)
   - Web: No device identification - WebSerial can't distinguish between identical devices

### User Pain Points

- **Different Mental Models**: Same operations require different approaches per platform
- **Web Complexity Exposure**: Users must understand servo protocols and multi-step procedures
- **Inconsistent Resource Management**: Some platforms auto-manage, others don't
- **Device Identification Issues**: Web can't identify which physical robot is connected
- **Hidden State Problems**: Users can't control when connections happen or track device status

## 🎯 Success Criteria

### Primary Goal: Building Block Consistency

- [ ] **Same Operation Patterns**: All platforms use identical patterns for core operations
- [ ] **Clean Responsibility Split**: Users manage state/UI, library handles robotics
- [ ] **Self-Contained Operations**: Each function manages its own connection lifecycle
- [ ] **Unified Control Model**: Long-running operations use same session-based control

### Secondary Goal: Platform-Appropriate Implementation

- [ ] **Smart Device Pairing**: Web uses WebUSB + WebSerial for device identification + communication
- [ ] **Hidden Robotics Complexity**: Baud rates, protocols, servo commands abstracted away
- [ ] **Graceful Resource Management**: Automatic connection cleanup with user control
- [ ] **Consistent Error Handling**: Platform-specific errors mapped to common patterns

## 📋 Ground Truth Decisions

### 1. Building Block Philosophy

**DECIDED: User manages state, we provide clean tools**

✅ **User Responsibilities:**

- Device pairing and storage (when to pair, how to persist)
- UI workflow (when to show dialogs, how to display progress)
- State management (which devices they have, tracking connections)
- Error handling UI (how to display errors to end users)

✅ **Library Responsibilities:**

- WebUSB + WebSerial pairing dialogs (native browser interactions)
- Baud rate configuration (1000000 for SO-100)
- STS3215 servo protocol implementation
- Calibration and teleoperation procedures
- Resource conflict prevention with clear error messages

### 2. Device Pairing vs Connection Pattern

**DECIDED: Separate pairing (once) from connection (per operation)**

```javascript
// PAIRING: One-time device identification (stores device reference)
const deviceInfo = await lerobot.pairDevice();
// User stores this: localStorage, state management, etc.

// OPERATIONS: Each function connects internally using device reference
const session = await lerobot.calibrate({ robot: { device: deviceInfo } });
await session.stop(); // Graceful disconnect

const session2 = await lerobot.teleoperate({ robot: { device: deviceInfo } });
await session2.stop(); // Independent connection lifecycle
```

**Web Implementation Details:**

- `pairDevice()` shows WebUSB dialog → gets device info → shows WebSerial dialog → extracts serial ID
- Each operation connects to paired device internally (no singleton state)
- Users never see servo protocols, baud rates, or connection management

### 3. Connection Lifecycle Pattern

**DECIDED: Each operation is self-contained (like Python/Node.js)**

```javascript
// PYTHON/NODE.JS CURRENT PATTERN (keep this):
await calibrate(config); // Internally: connect → calibrate → disconnect
await teleoperate(config); // Internally: connect → teleoperate → disconnect

// WEB NEW PATTERN (match Python/Node.js):
const cal = await calibrate({ robot: { device: pairedDevice } }); // connect → start calibration
await cal.stop(); // disconnect

const tel = await teleoperate({ robot: { device: pairedDevice } }); // connect → start teleoperation
await tel.stop(); // disconnect
```

**Key Principle:** No shared connections, no singletons, each operation manages its own lifecycle.

### 4. Long-Running Operation Control

**DECIDED: Both calibrate and teleoperate are long-running until user stops**

```javascript
// UNIFIED SESSION PATTERN for both operations:
interface RobotSession {
  stop(): Promise<void>; // Graceful shutdown + disconnect
  getState(): SessionState; // Current operation state
}

// Both operations return controllable sessions:
const calibration = await lerobot.calibrate({
  robot: { device: myDevice },
  onStateChange: (state) => updateUI(state),
});

const teleoperation = await lerobot.teleoperate({
  robot: { device: myDevice },
  onStateChange: (state) => updateUI(state),
});

// Same control pattern for both:
await calibration.stop();
await teleoperation.stop();
```

**Calibrate Reality Check:**

- Starts calibration procedure
- Waits for user to move robot through ranges
- Records positions until user decides to stop
- Can run indefinitely like teleoperate

### 5. Web Device Identification Solution

**DECIDED: WebUSB + WebSerial both required**

```javascript
// Why both APIs are needed:
// 1. WebUSB: Get device serial number → "This is robot arm #ABC123"
// 2. WebSerial: Actual communication → Send servo commands

async function pairDevice(): Promise<DeviceInfo> {
  // Step 1: WebUSB for device identification
  const usbDevice = await navigator.usb.requestDevice({...});
  const serialId = extractSerialNumber(usbDevice);

  // Step 2: WebSerial for communication
  const serialPort = await navigator.serial.requestPort();
  await serialPort.open({ baudRate: 1000000 }); // We handle baud rate

  return {
    serialId,
    usbDevice,
    serialPort,
    type: detectRobotType(usbDevice) // We detect SO-100 vs other robots
  };
}
```

## 🛠️ Implementation Architecture

### Core Building Blocks

```javascript
// DEVICE PAIRING (Web-specific, one-time)
export async function pairDevice(): Promise<DeviceInfo>

// UNIFIED OPERATIONS (Same across all platforms)
export async function calibrate(config: CalibrationConfig): Promise<CalibrationSession>
export async function teleoperate(config: TeleoperationConfig): Promise<TeleoperationSession>

// UNIFIED SESSION CONTROL
interface RobotSession {
  stop(): Promise<void>
  getState(): SessionState
}
```

### Platform-Specific Implementation

**Node.js (No changes needed - already correct pattern):**

```javascript
// Each function connects/disconnects internally - keep as-is
export async function calibrate(config) {
  const device = createDevice(config.robot);
  await device.connect();
  // ... calibration work
  await device.disconnect();
}
```

**Web (New unified wrapper):**

```javascript
// Hide controller complexity behind unified interface
export async function calibrate(config) {
  let connection = null;
  try {
    connection = await connectToDevice(config.robot.device); // We handle WebSerial setup
    const session = new CalibrationSession(connection, config);
    return session; // User controls session lifecycle
  } catch (error) {
    if (connection) await connection.disconnect();
    throw error;
  }
}
```

## 📋 Detailed API Specification

### 1. Device Pairing API (Web Only)

```javascript
// Web-specific device pairing
interface DeviceInfo {
  serialId: string;        // From WebUSB device descriptor
  robotType: 'so100_follower' | 'so100_leader';
  usbVendorId: number;
  usbProductId: number;
  // Internal connection details (user doesn't need to know)
}

export async function pairDevice(): Promise<DeviceInfo>
```

**User Workflow:**

1. Call `pairDevice()` → Native browser dialogs appear
2. Store `DeviceInfo` in their state management
3. Use stored device for all subsequent operations

### 2. Unified Calibration API

```javascript
interface CalibrationConfig {
  robot: {
    device: DeviceInfo;     // Web: paired device, Node.js: { type, port }
  };
  onStateChange?: (state: 'connecting' | 'connected' | 'active' | 'stopping' | 'stopped') => void;
  onProgress?: (progress: CalibrationProgress) => void;
}

interface CalibrationSession extends RobotSession {
  stop(): Promise<CalibrationResults>;  // Returns calibration data
}

// SAME across all platforms:
export async function calibrate(config: CalibrationConfig): Promise<CalibrationSession>
```

### 3. Unified Teleoperation API

```javascript
interface TeleoperationConfig {
  robot: {
    device: DeviceInfo;     // Web: paired device, Node.js: { type, port }
  };
  controls?: {
    [key: string]: ControlMapping;
  };
  onStateChange?: (state: SessionState) => void;
}

interface TeleoperationSession extends RobotSession {
  updateKeyState(key: string, pressed: boolean): void; // For keyboard control
  getCurrentPositions(): Promise<Record<string, number>>;
}

// SAME across all platforms:
export async function teleoperate(config: TeleoperationConfig): Promise<TeleoperationSession>
```

### 4. Error Handling

```javascript
// Standard error types across platforms
class DeviceNotPairedError extends Error {}
class DeviceConnectionError extends Error {}
class DeviceAlreadyConnectedError extends Error {}
class CalibrationError extends Error {}
class TeleoperationError extends Error {}

// Platform-specific errors mapped to standard types
// Web: WebSerial/WebUSB errors → DeviceConnectionError
// Node.js: SerialPort errors → DeviceConnectionError
```

## 🔄 User Experience Flows

### First-Time Web User

```javascript
// 1. Pair device once (shows native browser dialogs)
const myRobot = await lerobot.pairDevice();
localStorage.setItem("myRobot", JSON.stringify(myRobot));

// 2. Use paired device for operations
const calibration = await lerobot.calibrate({
  robot: { device: myRobot },
  onStateChange: (state) => updateStatus(state),
});

// 3. User controls session
await calibration.stop();
```

### Returning Web User

```javascript
// 1. Load stored device (no browser dialogs)
const myRobot = JSON.parse(localStorage.getItem("myRobot"));

// 2. Operations work immediately (connect internally)
const teleoperation = await lerobot.teleoperate({
  robot: { device: myRobot },
  onStateChange: (state) => updateStatus(state),
});
```

### Node.js User (Unchanged)

```javascript
// Same as current - no changes needed
const calibration = await lerobot.calibrate({
  robot: { type: "so100_follower", port: "COM4" },
});
await calibration.stop();
```

## 🧪 Implementation Phases

### Phase 1: Core Building Blocks

- [ ] Define unified interfaces (`RobotSession`, `DeviceInfo`)
- [ ] Implement Web `pairDevice()` with WebUSB + WebSerial
- [ ] Create session-based wrappers for Web calibration/teleoperation
- [ ] Standardize error types and mapping

### Phase 2: API Unification

- [ ] Ensure Node.js returns session objects (minimal changes)
- [ ] Web operations return sessions that hide controller complexity
- [ ] Unified state change callbacks and progress reporting
- [ ] Cross-platform testing with real hardware

### Phase 3: Developer Experience

- [ ] Update examples to use building block pattern
- [ ] Create migration guide from current APIs
- [ ] Unified documentation with platform-specific notes
- [ ] Performance optimization and bundle size analysis

## 📊 Success Metrics

### Developer Experience

- [ ] **Single Learning Curve**: Core concepts (pairing, sessions, operations) work everywhere
- [ ] **User Control**: Developers control state, UI, and workflow completely
- [ ] **Platform Abstraction**: Robotics complexity hidden, platform differences minimal

### Technical Quality

- [ ] **Resource Management**: No connection leaks, graceful cleanup
- [ ] **Error Handling**: Clear, actionable errors with consistent types
- [ ] **Performance**: No regressions, efficient resource usage

### API Consistency

- [ ] **Same Patterns**: Operations, sessions, and control work identically
- [ ] **Platform Appropriate**: Each platform uses native capabilities optimally
- [ ] **Migration Path**: Existing code can adopt new patterns incrementally

## 🔍 Edge Cases & Considerations

### Multiple Device Management

```javascript
// User manages multiple devices
const robot1 = await lerobot.pairDevice(); // First robot
const robot2 = await lerobot.pairDevice(); // Second robot

// Independent sessions
const cal1 = await lerobot.calibrate({ robot: { device: robot1 } });
const tel2 = await lerobot.teleoperate({ robot: { device: robot2 } });
```

### Resource Conflicts

```javascript
// Library prevents conflicts with clear errors
const session1 = await lerobot.calibrate({ robot: { device: myRobot } });

try {
  const session2 = await lerobot.teleoperate({ robot: { device: myRobot } });
} catch (error) {
  if (error instanceof DeviceAlreadyConnectedError) {
    // User gets clear message: "Device already in use by calibration. Stop calibration first."
    await session1.stop();
    const session2 = await lerobot.teleoperate({ robot: { device: myRobot } });
  }
}
```

### Browser Tab Management

```javascript
// Sessions automatically cleanup on page unload
window.addEventListener("beforeunload", async () => {
  if (currentSession) {
    await currentSession.stop(); // Graceful disconnect
  }
});
```

## 📝 Definition of Done

- [ ] **Web Pairing**: `pairDevice()` uses WebUSB + WebSerial to identify and store device info
- [ ] **Session Control**: Both `calibrate()` and `teleoperate()` return controllable sessions
- [ ] **Self-Contained Operations**: Each operation connects/disconnects internally, no shared state
- [ ] **Unified Error Handling**: Platform-specific errors mapped to consistent error types
- [ ] **Resource Management**: Clear error messages for conflicts, automatic cleanup
- [ ] **Documentation**: Single API reference with platform-specific implementation notes
- [ ] **Migration Path**: Existing users can adopt new patterns without breaking changes
- [ ] **Hardware Validation**: Tested with real SO-100 hardware on all platforms

---

**Priority**: 🔴 Critical - Blocks adoption due to API inconsistency
**Effort**: 🔥🔥🔥 High - Significant Web refactoring, but Node.js mostly unchanged
**Impact**: 🚀🚀🚀 Transformative - Enables true cross-platform development

**Impact**: 🚀🚀🚀 Very High - Transforms user experience and enables widespread adoption

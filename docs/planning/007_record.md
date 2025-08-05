# User Story 007: Clean Record API Implementation

## Story

**As a** robotics developer building teleoperation recording systems  
**I want** to record robot motor positions and control data using a clean `record()` function API  
**So that** I can capture teleoperation sessions for training AI models, analysis, and replay without dealing with complex class-based APIs or mixed concerns

## Background

A community contributor has provided a recording implementation in this PR branch, which includes a comprehensive `LeRobotDatasetRecorder` class with video recording, data export, and LeRobot dataset format support. However, the current implementation violates several of our core conventions and doesn't match the clean API patterns established by `calibrate()`, `teleoperate()`, and `findPort()`.

### Current Implementation Problems

The existing `LeRobotDatasetRecorder` implementation has several architectural issues:

- **Missing Standard Library Pattern**: Uses class instantiation instead of simple function call like our other APIs
- **Library vs Demo Separation Violation**: Mixes hardware recording (library concern) with video streams, export formats, and UI (demo concerns)
- **Teleoperator Integration Issues**: Recording logic deeply embedded in `BaseWebTeleoperator` with complex state management
- **Complex Constructor Anti-Pattern**: Requires pre-configured teleoperators and video streams, violating our "direct library usage" principle
- **Export API Complexity**: ZIP, HuggingFace, and S3 upload belong in demo code, not standard library
- **No Clean Process API**: Doesn't follow our consistent `start()/stop()/result` pattern
- **Redundant Event System**: Uses `dispatchMotorPositionChanged` events that aren't consumed and duplicate callback functionality
- **Artificial Polling**: 100ms polling in teleoperate instead of immediate callbacks when motors change

### Convention Alignment Needed

Our established patterns from `calibrate()`, `teleoperate()`, and `findPort()` follow these principles:

- **Simple Function API**: `const process = await record(config)`
- **Clean Process Objects**: Consistent `start()`, `stop()`, `getState()`, `result` interface
- **Hardware-Only Library**: Standard library handles only robotics hardware, not UI/storage/export
- **Demo Handles UI**: Examples handle video, export formats, browser storage, file downloads
- **Immediate Callbacks**: Real-time updates via callbacks, not polling or unused events
- **Direct Usage**: End users call library functions directly without complex setup

## Acceptance Criteria

### Core Functionality

- [ ] **Standard Library API**: Clean `record(config)` function matching our established patterns
- [ ] **Process Object Interface**: Consistent `RecordProcess` with `start()`, `stop()`, `getState()`, `result` methods
- [ ] **Hardware-Only Recording**: Library captures only robot motor positions and teleoperation data
- [ ] **Real-Time Callbacks**: Immediate `onDataUpdate` and `onStateUpdate` callbacks, no polling
- [ ] **Device-Agnostic**: Works with any robot type through configuration, not hardcoded values
- [ ] **Clean Teleoperator Integration**: Recording subscribes to teleoperation changes without embedding in teleoperator classes

### User Experience

- [ ] **Simple Integration**: Easy to add recording to existing teleoperation workflows
- [ ] **Consistent API**: Same patterns as `calibrate()` and `teleoperate()` for familiar developer experience
- [ ] **Immediate Feedback**: Real-time recording state and data updates for responsive UI
- [ ] **Error Handling**: Clear error messages for recording failures or invalid configurations
- [ ] **Resource Management**: Proper cleanup of recording resources on stop/disconnect

### Technical Requirements

- [ ] **Library/Demo Separation**: Move video, export, and storage logic to examples/demo layer
- [ ] **Remove Event System**: Eliminate unused `dispatchMotorPositionChanged` events, use callbacks only
- [ ] **Extract from Teleoperators**: Remove recording state and logic from `BaseWebTeleoperator`
- [ ] **TypeScript**: Fully typed with proper interfaces for recording configuration and data
- [ ] **No Code Duplication**: Reuse existing teleoperation and motor communication infrastructure
- [ ] **Performance**: Immediate callbacks when data changes, no unnecessary polling

## Expected User Flow

### Basic Robot Recording

```typescript
import { record } from "@lerobot/web";

// Clean API matching our conventions
const recordProcess = await record({
  robot: connectedRobot,
  options: {
    fps: 30,
    onDataUpdate: (data) => {
      // Real-time recording data for UI feedback
      console.log(`Recorded ${data.frameCount} frames`);
      updateRecordingUI(data);
    },
    onStateUpdate: (state) => {
      // Recording state changes
      console.log(`Recording: ${state.isActive}`);
      updateRecordingStatus(state);
    },
  },
});

// Consistent process interface
recordProcess.start();

// Recording runs automatically while teleoperation is active
setTimeout(() => {
  recordProcess.stop();
}, 30000);

// Get pure robot recording data
const robotData = await recordProcess.result;
console.log("Episodes:", robotData.episodes);
console.log("Metadata:", robotData.metadata);
```

### Recording with Teleoperation

```typescript
import { teleoperate, record } from "@lerobot/web";

// Start teleoperation
const teleoperationProcess = await teleoperate({
  robot: connectedRobot,
  teleop: { type: "keyboard" },
  calibrationData: calibrationData,
  onStateUpdate: (state) => {
    updateTeleoperationUI(state);
  },
});

// Add recording to existing teleoperation
const recordProcess = await record({
  robot: connectedRobot,
  options: {
    onDataUpdate: (data) => {
      console.log(`Recording frame ${data.frameCount}`);
    },
  },
});

// Both run independently
teleoperationProcess.start();
recordProcess.start();

// Control independently
setTimeout(() => {
  recordProcess.stop(); // Stop recording, keep teleoperation
}, 60000);

setTimeout(() => {
  teleoperationProcess.stop(); // Stop teleoperation
}, 120000);
```

### Demo-Layer Dataset Export

```typescript
// In examples/demo - NOT in standard library
import { record } from "@lerobot/web";
import { DatasetExporter } from "./dataset-exporter"; // Demo code

const recordProcess = await record({ robot, options });
recordProcess.start();

// ... recording session ...

recordProcess.stop();
const robotData = await recordProcess.result;

// Demo handles complex export logic
const exporter = new DatasetExporter({
  robotData,
  videoStreams: cameraStreams, // Demo manages video
  taskDescription: "Pick and place task",
});

// Export options handled by demo
await exporter.downloadZip();
await exporter.uploadToHuggingFace({ apiKey, repoName });
await exporter.uploadToS3({ credentials });
```

### Component Integration

```typescript
// React component - direct library usage like calibration
const [recordingState, setRecordingState] = useState<RecordingState>();
const [recordingData, setRecordingData] = useState<RecordingData>();
const recordProcessRef = useRef<RecordProcess | null>(null);

useEffect(() => {
  const initRecording = async () => {
    const process = await record({
      robot,
      options: {
        onStateUpdate: setRecordingState,
        onDataUpdate: setRecordingData,
      },
    });
    recordProcessRef.current = process;
  };
  initRecording();
}, [robot]);

const handleStartRecording = () => {
  recordProcessRef.current?.start();
};

const handleStopRecording = async () => {
  recordProcessRef.current?.stop();
  const data = await recordProcessRef.current?.result;
  // Handle recorded data
};
```

## Implementation Details

### File Structure Refactoring

```
packages/web/src/
├── record.ts                         # NEW: Clean record() function
├── types/
│   └── recording.ts                  # NEW: Recording-specific types
├── utils/
│   └── recording-manager.ts          # NEW: Internal recording logic
├── teleoperators/
│   └── base-teleoperator.ts          # UPDATED: Remove recording logic
└── [MOVED TO EXAMPLES]
    ├── LeRobotDatasetRecorder.ts      # Complex export logic
    ├── dataset-exporter.ts            # Video + export functionality
    └── upload-handlers.ts             # HuggingFace, S3 upload logic
```

### Key Dependencies

#### No New Dependencies for Standard Library

- **Existing**: Reuse all current dependencies (motor communication, teleoperation integration)
- **Architecture Only**: Pure refactoring to clean up existing functionality

#### Demo Dependencies (Moved)

- **Video/Export**: `parquet-wasm`, `apache-arrow`, `jszip` - moved to examples
- **Upload**: `@huggingface/hub`, AWS SDK - moved to examples

### Core Functions to Implement

#### Clean Record API

```typescript
// record.ts - New clean API
interface RecordConfig {
  robot: RobotConnection;
  options?: {
    fps?: number; // Default: 30
    onDataUpdate?: (data: RecordingData) => void;
    onStateUpdate?: (state: RecordingState) => void;
  };
}

interface RecordProcess {
  start(): void;
  stop(): void;
  getState(): RecordingState;
  result: Promise<RobotRecordingData>;
}

interface RecordingState {
  isActive: boolean;
  frameCount: number;
  episodeCount: number;
  duration: number; // milliseconds
  lastUpdate: number;
}

interface RecordingData {
  frameCount: number;
  currentEpisode: number;
  recentFrames: MotorPositionFrame[]; // Last few frames for UI
}

interface RobotRecordingData {
  episodes: MotorPositionFrame[][]; // Pure motor data only
  metadata: {
    fps: number;
    robotType: string;
    startTime: number;
    endTime: number;
    totalFrames: number;
    totalEpisodes: number;
  };
}

// Main function - matches our conventions
export async function record(config: RecordConfig): Promise<RecordProcess>;
```

#### Recording Manager (Internal)

```typescript
// utils/recording-manager.ts - Internal implementation
class RecordingManager {
  private robot: RobotConnection;
  private isActive: boolean = false;
  private episodes: MotorPositionFrame[][] = [];
  private currentEpisode: MotorPositionFrame[] = [];
  private startTime: number = 0;
  private frameCount: number = 0;

  constructor(
    robot: RobotConnection,
    private options: RecordOptions,
    private onDataUpdate?: (data: RecordingData) => void,
    private onStateUpdate?: (state: RecordingState) => void
  ) {
    this.robot = robot;
  }

  start(): void {
    if (this.isActive) return;

    this.isActive = true;
    this.startTime = Date.now();

    // Subscribe to teleoperation changes (NO events, just callbacks)
    this.subscribeToRobotChanges();

    this.notifyStateUpdate();
  }

  stop(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.finishCurrentEpisode();
    this.unsubscribeFromRobotChanges();

    this.notifyStateUpdate();
  }

  private subscribeToRobotChanges(): void {
    // Listen to existing teleoperation callbacks - no new events needed
    // This integrates with the existing onStateUpdate mechanism
  }

  private recordFrame(motorConfigs: MotorConfig[]): void {
    const frame: MotorPositionFrame = {
      timestamp: Date.now() - this.startTime,
      motorPositions: motorConfigs.map((config) => ({
        id: config.id,
        name: config.name,
        position: config.currentPosition,
      })),
      frameIndex: this.frameCount++,
    };

    this.currentEpisode.push(frame);

    if (this.onDataUpdate) {
      this.onDataUpdate({
        frameCount: this.frameCount,
        currentEpisode: this.episodes.length,
        recentFrames: this.currentEpisode.slice(-10), // Last 10 frames
      });
    }
  }

  getState(): RecordingState {
    return {
      isActive: this.isActive,
      frameCount: this.frameCount,
      episodeCount: this.episodes.length,
      duration: this.isActive ? Date.now() - this.startTime : 0,
      lastUpdate: Date.now(),
    };
  }

  async getResult(): Promise<RobotRecordingData> {
    return {
      episodes: [...this.episodes],
      metadata: {
        fps: this.options.fps || 30,
        robotType: this.robot.robotType || "unknown",
        startTime: this.startTime,
        endTime: Date.now(),
        totalFrames: this.frameCount,
        totalEpisodes: this.episodes.length,
      },
    };
  }
}
```

#### Updated Teleoperate Integration

```typescript
// teleoperate.ts - Remove 100ms polling, add immediate callbacks
export async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess> {
  const teleoperator = await createTeleoperatorProcess(config);

  return {
    start: () => {
      teleoperator.start();

      // NO MORE 100ms polling! Use immediate callbacks
      if (config.onStateUpdate) {
        teleoperator.setStateUpdateCallback(config.onStateUpdate);
      }
    },
    // ... rest of interface
  };
}
```

#### Clean Teleoperator Base

```typescript
// teleoperators/base-teleoperator.ts - Remove recording logic
export abstract class BaseWebTeleoperator extends WebTeleoperator {
  protected port: MotorCommunicationPort;
  public motorConfigs: MotorConfig[] = [];
  protected isActive: boolean = false;

  // REMOVED: All recording-related properties
  // REMOVED: dispatchMotorPositionChanged events
  // REMOVED: recordedMotorPositions, episodeIndex, etc.

  private stateUpdateCallback?: (state: TeleoperationState) => void;

  setStateUpdateCallback(callback: (state: TeleoperationState) => void): void {
    this.stateUpdateCallback = callback;
  }

  protected motorPositionsChanged(): void {
    // Call immediately when motors change - no events, no 100ms delay
    if (this.stateUpdateCallback) {
      const state = this.buildCurrentState();
      this.stateUpdateCallback(state);
    }
  }

  // Clean implementation without recording concerns
}
```

### Technical Considerations

#### Migration Strategy

**Preserve Existing Functionality:**

1. **Move Complex Logic**: `LeRobotDatasetRecorder` moves to `examples/` as demo code
2. **Extract Clean Core**: Create new `record()` function for standard library
3. **Update Examples**: Cyberpunk demo uses new API with demo-layer export functionality
4. **Remove Event System**: Clean up unused `dispatchMotorPositionChanged` events
5. **Fix Polling**: Replace 100ms polling with immediate callbacks

#### Performance Improvements

- **Remove Polling**: Eliminate artificial 100ms delays in favor of immediate callbacks
- **Event-Driven**: Only fire callbacks when robot state actually changes
- **Memory Efficiency**: No unused event listeners or redundant data structures
- **Responsive UI**: Immediate feedback for recording status and data updates

#### Future Extensibility

The clean architecture supports advanced recording features as demo enhancements:

```typescript
// Future: Advanced demo features (NOT in standard library)
class AdvancedDatasetExporter extends DatasetExporter {
  // Video synchronization, multi-camera support
  // Cloud storage, data preprocessing
  // Visualization, playback, analysis tools
}
```

## Definition of Done

- [ ] **Clean Record API**: `record(config)` function implemented matching our established patterns
- [ ] **Process Interface**: `RecordProcess` with consistent `start()`, `stop()`, `getState()`, `result` methods
- [ ] **Hardware-Only Library**: Standard library captures only robot motor data, no video/export complexity
- [ ] **Demo Separation**: Video recording, export formats, and UI logic moved to examples layer
- [ ] **Remove Events**: `dispatchMotorPositionChanged` events eliminated, callbacks used exclusively
- [ ] **Fix Polling**: 100ms artificial polling replaced with immediate callbacks when motors change
- [ ] **Clean Teleoperators**: Recording logic extracted from `BaseWebTeleoperator` and teleoperator classes
- [ ] **TypeScript Coverage**: Full type safety with proper interfaces for all recording functionality
- [ ] **Performance**: Immediate, event-driven updates with no unnecessary polling or unused listeners
- [ ] **Integration**: Easy integration with existing teleoperation workflows using familiar patterns
- [ ] **Example Updates**: Cyberpunk demo updated to use new clean API with demo-layer export features
- [ ] **No Regression**: All existing recording functionality preserved through demo layer
- [ ] **Documentation**: Clear examples showing standard library vs demo separation

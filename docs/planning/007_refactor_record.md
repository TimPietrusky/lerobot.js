# User Story 007: Clean Record API Implementation

## Story

**As a** robotics developer building teleoperation recording systems  
**I want** to record robot motor positions and control data using a clean `record()` function API  
**So that** I can capture teleoperation sessions for training AI models, analysis, and replay with the same simple patterns as other LeRobot.js functions

## Background

A community contributor has successfully implemented comprehensive recording functionality, including a `LeRobotDatasetRecorder` class with video recording, data export, and LeRobot dataset format support. The implementation is functional and well-integrated, but doesn't follow our established simple function API patterns from `calibrate()`, `teleoperate()`, and `findPort()`.

### Current Recording Implementation (From README)

The existing system works as documented in the web package README:

```typescript
import { LeRobotDatasetRecorder } from "@lerobot/web";

// Create a recorder with teleoperator and video streams
const recorder = new LeRobotDatasetRecorder(
  [teleoperator], // Array of teleoperators to record
  { main: videoStream }, // Video streams by camera key
  30, // Target FPS
  "Pick and place task" // Task description
);

// Start recording
await recorder.startRecording();
// ... robot performs task ...
const recordingData = await recorder.stopRecording();

// Export the dataset in various formats
await recorder.exportForLeRobot("zip-download");
await recorder.exportForLeRobot("huggingface", { repoName, accessToken });
await recorder.exportForLeRobot("s3", { bucketName, credentials });
```

This implementation has **excellent architecture** - the explicit teleoperator dependency makes it clear, testable, and flexible.

### Current Implementation Status

The existing recording system is **fully functional** with these components:

✅ **Already Working Well:**

- `LeRobotDatasetRecorder` class with complete functionality
- Proper callback-based integration with teleoperators (no polling issues)
- Full LeRobot dataset format support with Parquet export
- Video recording and synchronization capabilities
- Complete cyberpunk example integration with camera management
- Clean separation between recording logic and teleoperator classes
- Export to ZIP, Hugging Face, and S3

### What Works Well (Keep This)

The current implementation has **excellent architectural decisions**:

- **Explicit Teleoperator Dependency**: `LeRobotDatasetRecorder([teleoperator], ...)` makes dependencies clear and predictable
- **Clean Separation**: Recording subscribes to teleoperator callbacks without tight coupling
- **Flexible Architecture**: Can record from any teleoperator, multiple teleoperators, or no teleoperator at all

### Areas for Improvement

The only issues are **API consistency** and **UI organization**:

- **Missing Simple Function API**: Users must instantiate `LeRobotDatasetRecorder` class directly instead of calling `record()` like other functions
- **UI Integration Pattern**: Recording is embedded within teleoperation view instead of being its own separate component/page
- **Library vs Demo Boundary**: Complex export functionality (video processing, cloud uploads) should be in demo layer, not standard library

### Convention Alignment Needed

Our established patterns from `calibrate()`, `teleoperate()`, and `findPort()` follow these principles:

- **Simple Function API**: `const process = await record(config)` (currently requires class instantiation)
- **Clean Process Objects**: Consistent `start()`, `stop()`, `getState()`, `result` interface (class has `startRecording()`, `stopRecording()`)
- **Hardware-Only Library**: Standard library handles only robotics hardware (currently includes video/export)
- **Demo Handles UI**: Examples handle video, export formats, browser storage, file downloads
- **Direct Usage**: End users call library functions directly without complex setup

## Acceptance Criteria

### Core Functionality

- [ ] **Standard Library API**: Clean `record(config)` function matching our established patterns (wrap existing `LeRobotDatasetRecorder`)
- [ ] **Process Object Interface**: Consistent `RecordProcess` with `start()`, `stop()`, `getState()`, `result` methods (adapt existing methods)
- [ ] **Hardware-Only Recording**: Library captures only robot motor positions and teleoperation data (move video/export to demo)
- [ ] **Clean Teleoperator Integration**: Recording uses existing callback system in `BaseWebTeleoperator`
- [ ] **Preserve Advanced Features**: Keep `LeRobotDatasetRecorder` class for users who need full control

### User Experience

- [ ] **Simple Integration**: Easy to add recording to existing teleoperation workflows
- [ ] **Consistent API**: Same patterns as `calibrate()` and `teleoperate()` for familiar developer experience
- [ ] **Separate UI Component**: Move recording from teleoperation view to its own dedicated page/section in cyberpunk example
- [ ] **Error Handling**: Clear error messages for recording failures or invalid configurations
- [ ] **Resource Management**: Proper cleanup of recording resources on stop/disconnect

### Technical Requirements

- [ ] **Library/Demo Separation**: Move video recording, complex export logic (HF, S3) to examples/demo layer
- [ ] **Wrapper Function**: Create simple `record()` function that wraps existing `LeRobotDatasetRecorder`
- [ ] **Preserve Existing Integration**: Keep current callback system in `BaseWebTeleoperator` (it works well)
- [ ] **TypeScript**: Fully typed with proper interfaces for recording configuration and data
- [ ] **No Breaking Changes**: Existing `LeRobotDatasetRecorder` class should remain available for advanced users

## Expected User Flow

### Basic Robot Recording (Proposed Simple API)

```typescript
import { teleoperate, record } from "@lerobot/web";

// 1. Create teleoperation first (existing pattern)
const teleoperationProcess = await teleoperate({
  robot: connectedRobot,
  teleop: { type: "keyboard" },
  calibrationData: calibrationData,
});

// 2. NEW: Clean API with explicit teleoperator dependency
const recordProcess = await record({
  teleoperator: teleoperationProcess.teleoperator, // ← Explicit dependency
  options: {
    fps: 30,
    taskDescription: "Pick and place task",
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

// 3. Start both processes
teleoperationProcess.start();
recordProcess.start();

// 4. Recording captures teleoperation automatically via callbacks
setTimeout(() => {
  recordProcess.stop();
}, 30000);

// 5. Get pure robot recording data (no video/export complexity)
const robotData = await recordProcess.result;
console.log("Episodes:", robotData.episodes);
console.log("Metadata:", robotData.metadata);
```

### Current Implementation (Works Well, Just Different API Style)

```typescript
import { LeRobotDatasetRecorder } from "@lerobot/web";

// CURRENT: Class-based API with explicit dependencies (good architecture!)
const recorder = new LeRobotDatasetRecorder(
  [teleoperator], // ← GOOD: Explicit teleoperator dependency
  { main: videoStream }, // Video complexity in library (to be moved)
  30, // fps
  "Pick and place task" // Task description
);

// Different method names than our conventions (but functional)
await recorder.startRecording();
// ... robot performs task ...
const result = await recorder.stopRecording();

// Complex export in standard library (should be demo-only)
await recorder.exportForLeRobot("zip-download");
await recorder.exportForLeRobot("huggingface", { repoName, accessToken });
```

**What's Good About Current Implementation:**

- ✅ **Explicit Dependencies**: Clear what the recorder needs to work
- ✅ **Clean Architecture**: Recording subscribes to teleoperator via callbacks
- ✅ **Full Functionality**: Complete LeRobot dataset format support
- ✅ **Flexible**: Can record from any teleoperator instance

### Recording with Teleoperation (Proposed Simple API)

```typescript
import { teleoperate, record } from "@lerobot/web";

// 1. Start teleoperation (existing pattern)
const teleoperationProcess = await teleoperate({
  robot: connectedRobot,
  teleop: { type: "keyboard" },
  calibrationData: calibrationData,
  onStateUpdate: (state) => {
    updateTeleoperationUI(state);
  },
});

// 2. NEW: Add recording with explicit teleoperator dependency
const recordProcess = await record({
  teleoperator: teleoperationProcess.teleoperator, // ← Explicit dependency (good!)
  options: {
    fps: 30,
    taskDescription: "Pick and place task",
    onDataUpdate: (data) => {
      console.log(`Recording frame ${data.frameCount}`);
    },
  },
});

// 3. Both run independently
teleoperationProcess.start();
recordProcess.start();

// 4. Control independently
setTimeout(() => {
  recordProcess.stop(); // Stop recording, keep teleoperation
}, 60000);

setTimeout(() => {
  teleoperationProcess.stop(); // Stop teleoperation
}, 120000);
```

**Why Explicit Teleoperator Dependency is Good:**

- 🎯 **Clear**: You know exactly what gets recorded
- 🔧 **Flexible**: Can record from any teleoperator
- 🧪 **Testable**: Easy to mock teleoperator for testing
- 📦 **Reusable**: Same teleoperator can serve multiple recorders

### Demo-Layer Dataset Export (Proposed Architecture)

```typescript
// In examples/demo - NOT in standard library
import { record } from "@lerobot/web";
import { DatasetExporter } from "./dataset-exporter"; // MOVE complex logic here

const recordProcess = await record({ robot, options });
recordProcess.start();

// ... recording session ...

recordProcess.stop();
const robotData = await recordProcess.result; // Pure motor data only

// MOVE TO DEMO: Complex export logic with video/cloud features
const exporter = new DatasetExporter({
  robotData,
  videoStreams: cameraStreams, // Demo manages video
  taskDescription: "Pick and place task",
});

// MOVE TO DEMO: Export options
await exporter.downloadZip();
await exporter.uploadToHuggingFace({ apiKey, repoName });
await exporter.uploadToS3({ credentials });
```

### Current Cyberpunk Example Integration

```typescript
// CURRENT: Recording embedded in teleoperation view
// examples/cyberpunk-standalone/src/components/teleoperation-view.tsx
<TeleoperationView robot={robot} />
// ^ Contains embedded <Recorder /> component

// PROPOSED: Separate recording page/component
// examples/cyberpunk-standalone/src/components/recording-view.tsx
<RecordingView robot={robot} />
// ^ Dedicated component with full recording interface
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

### File Structure Changes

```
packages/web/src/
├── record.ts                         # UPDATE: Add simple record() function wrapper
├── record-class.ts                   # RENAME: Move LeRobotDatasetRecorder here
├── types/
│   └── recording.ts                  # NEW: Recording-specific types for simple API
├── teleoperators/
│   └── base-teleoperator.ts          # KEEP: Current callback system works well
└── [MOVE TO EXAMPLES]
    ├── dataset-exporter.ts            # Video recording + export functionality
    ├── hf_uploader.ts                 # HuggingFace upload logic
    └── s3_uploader.ts                 # S3 upload logic
```

### Current vs Proposed Architecture

**Current (Working):**

- `LeRobotDatasetRecorder` class with full functionality
- Integrated in cyberpunk example within teleoperation view
- Video, HF, S3 export in standard library

**Proposed (Convention-Aligned):**

- Simple `record()` function wrapping existing class
- Separate recording component/page in cyberpunk example
- Video, HF, S3 export moved to demo layer
- Keep existing class available for advanced users

### Key Dependencies

#### Standard Library (Minimal Changes)

- **Keep Existing**: All current dependencies for core recording functionality
- **Wrapper Only**: Simple `record()` function is just a wrapper, no new dependencies

#### Demo Dependencies (To Be Moved)

- **Video/Export**: `parquet-wasm`, `apache-arrow`, `jszip` - move to examples
- **Upload**: `@huggingface/hub`, AWS SDK - move to examples
- **Keep Available**: Advanced users can still import `LeRobotDatasetRecorder` for full features

### Core Functions to Implement

#### Simple Record API (Wrapper)

```typescript
// record.ts - Simple wrapper around existing LeRobotDatasetRecorder
interface RecordConfig {
  teleoperator: WebTeleoperator; // ← Explicit dependency (keep this!)
  options?: {
    fps?: number; // Default: 30
    taskDescription?: string;
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
  recentFrames: any[]; // Simplified for basic API
}

interface RobotRecordingData {
  episodes: any[]; // Pure motor data only (no video)
  metadata: {
    fps: number;
    robotType: string;
    startTime: number;
    endTime: number;
    totalFrames: number;
    totalEpisodes: number;
  };
}

// Simple wrapper function - internally uses LeRobotDatasetRecorder
// Preserves the excellent explicit dependency architecture
export async function record(config: RecordConfig): Promise<RecordProcess>;
```

#### Implementation Strategy

**Phase 1: Simple Wrapper (Preserves Current Architecture)**

```typescript
// record.ts - Simple wrapper implementation
import { LeRobotDatasetRecorder } from "./record-class.js";

export async function record(config: RecordConfig): Promise<RecordProcess> {
  // Use the provided teleoperator (explicit dependency - good!)
  const recorder = new LeRobotDatasetRecorder(
    [config.teleoperator], // ← Use explicit teleoperator dependency
    {}, // No video streams in simple API (move to demo)
    config.options?.fps || 30,
    config.options?.taskDescription || "Robot recording"
  );

  return {
    start: () => {
      recorder.startRecording();
      if (config.options?.onStateUpdate) {
        // Set up state update polling for simple API
        const updateLoop = () => {
          if (recorder.isRecording) {
            config.options.onStateUpdate!({
              isActive: recorder.isRecording,
              frameCount: recorder.teleoperatorData.length,
              episodeCount: recorder.teleoperatorData.length,
              duration: Date.now() - (recorder as any).startTime,
              lastUpdate: Date.now(),
            });
            setTimeout(updateLoop, 100);
          }
        };
        updateLoop();
      }
    },
    stop: () => {
      return recorder.stopRecording();
    },
    getState: () => ({
      isActive: recorder.isRecording,
      frameCount: recorder.teleoperatorData.length,
      episodeCount: recorder.teleoperatorData.length,
      duration: 0, // Calculate from recorder
      lastUpdate: Date.now(),
    }),
    result: recorder.stopRecording().then(() => ({
      episodes: recorder.episodes, // Pure motor data
      metadata: {
        fps: config.options?.fps || 30,
        robotType: "unknown", // Get from teleoperator if possible
        startTime: Date.now(),
        endTime: Date.now(),
        totalFrames: recorder.teleoperatorData.length,
        totalEpisodes: recorder.teleoperatorData.length,
      },
    })),
  };
}
```

**Key Benefits of This Approach:**

- ✅ **Preserves Explicit Dependencies**: Keeps the excellent `teleoperator` parameter
- ✅ **Minimal Changes**: Just wraps existing `LeRobotDatasetRecorder`
- ✅ **No Breaking Changes**: Current class remains available
- ✅ **Consistent API**: Follows `start()`, `stop()`, `getState()`, `result` pattern

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

### Phase 1: Simple Function API (Priority)

- [ ] **Clean Record API**: `record(config)` function implemented as wrapper around existing `LeRobotDatasetRecorder`
- [ ] **Process Interface**: `RecordProcess` with consistent `start()`, `stop()`, `getState()`, `result` methods
- [ ] **Hardware-Only Simple API**: Simple `record()` function captures only robot motor data (no video)
- [ ] **Preserve Advanced Features**: Keep existing `LeRobotDatasetRecorder` class available for full functionality
- [ ] **TypeScript Coverage**: Full type safety with proper interfaces for simple recording API

### Phase 2: UI Separation (Secondary)

- [ ] **Separate Recording Component**: Move recording from teleoperation view to dedicated component/page
- [ ] **Clean Navigation**: Add recording as separate section in cyberpunk example navigation
- [ ] **No Breaking Changes**: Existing functionality continues to work during transition

### Phase 3: Library/Demo Boundary (Future)

- [ ] **Demo Separation**: Video recording, export formats moved to examples layer (optional enhancement)
- [ ] **Advanced Export Demo**: Create demo showing complex export features using `LeRobotDatasetRecorder`
- [ ] **Documentation**: Clear examples showing simple API vs advanced class usage

### Success Criteria

- [ ] **API Consistency**: `record()` function follows same patterns as `calibrate()` and `teleoperate()`
- [ ] **No Regression**: All existing recording functionality preserved and working
- [ ] **Easy Migration**: Users can easily switch between simple API and advanced class
- [ ] **Clean Example**: Recording has its own dedicated UI section in cyberpunk demo

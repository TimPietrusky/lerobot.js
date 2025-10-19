# User Story 008: Hand Tracking Teleoperation

## Story

**As a** robotics developer building intuitive robot control interfaces  
**I want** to control my robot using hand tracking via webcam  
**So that** I can teleoperate the robot naturally without keyboard/gamepad, mapping hand movements directly to robot arm positions

## Background

The project currently supports keyboard and gamepad teleoperation. Hand tracking provides a more natural and intuitive control method, especially for demonstrations and users unfamiliar with traditional input devices. A proven implementation exists in [roboter](https://github.com/therealadityashankar/roboter) that successfully maps hand gestures to SO-100 robot control using TensorFlow.js hand pose detection.

### Reference Implementation

The [planar.tsx implementation](https://raw.githubusercontent.com/therealadityashankar/roboter/refs/heads/main/src/planar.tsx) provides working hand tracking with these features:

**Hand Pose Detection:**

- TensorFlow.js with WebGL backend for real-time hand tracking
- `@tensorflow-models/hand-pose-detection` for accurate keypoint detection
- Smoothed detection to reduce jitter and improve control stability

**Gesture Mapping:**

- **X/Y Position**: Index finger tip position → robot planar coordinates
- **Z-Axis (Depth)**: Thumb-index pinch distance → robot arm extension
- **Gripper Angle**: Wrist rotation → gripper rotation
- **Gripper Mouth**: Thumb-index distance → gripper open/close
- **Wrist Flex**: Pinky-thumb touch rotation → wrist flex angle

**User Experience:**

- Real-time video feed with hand keypoint visualization
- Canvas overlay showing tracked finger positions
- Visual feedback for active gestures
- Buffer zones to prevent edge-triggered movements
- Configurable Z-axis range mapping

### Current State

**Existing Infrastructure:**

- ✅ `BaseWebTeleoperator` class for teleoperator implementations
- ✅ Keyboard teleoperator working with motor control
- ✅ Teleoperation view with teleoperator activation
- ✅ Recording view with webcam integration and stream management
- ✅ Motor communication protocols for SO-100

**What We Need:**

- New `HandTrackingTeleoperator` class extending `BaseWebTeleoperator`
- Integration of TensorFlow.js hand pose detection
- Webcam stream management in teleoperation view (reuse from recording)
- Hand gesture → motor position mapping logic
- Visual feedback for hand tracking status

## Acceptance Criteria

### Core Functionality

- [ ] **Hand Tracking Teleoperator**: New `HandTrackingTeleoperator` class implementing hand-based robot control
- [ ] **TensorFlow Integration**: Hand pose detection using `@tensorflow-models/hand-pose-detection`
- [ ] **Gesture Mapping**: Convert hand keypoints to robot motor positions (6 DOF for SO-100)
- [ ] **Real-time Control**: Smooth, responsive hand tracking with minimal latency
- [ ] **Webcam Integration**: Camera stream management integrated into teleoperation view

### User Experience

- [ ] **Activation Flow**: Hand tracking appears in teleoperator selector, activates on user click
- [ ] **Visual Feedback**: Live video feed with hand keypoint overlay on canvas
- [ ] **Gesture Indicators**: Visual cues showing active gestures (pinch, rotation, etc.)
- [ ] **Camera Permissions**: Clear prompts for webcam access with error handling
- [ ] **Performance**: Maintains 30+ FPS hand tracking without blocking robot control

### Technical Requirements

- [ ] **Platform Separation**: Hand tracking only in `@lerobot/web` (uses browser APIs)
- [ ] **Device Agnostic**: Configurable mapping for different robot types
- [ ] **Clean Integration**: Follows existing teleoperator patterns and conventions
- [ ] **Resource Management**: Proper cleanup of TensorFlow models and video streams
- [ ] **TypeScript**: Fully typed with proper interfaces for hand tracking configuration

## Expected User Flow

### Basic Hand Tracking Setup

```typescript
import { teleoperate } from "@lerobot/web";

// Create teleoperation with hand tracking
const teleoperationProcess = await teleoperate({
  robot: connectedRobot,
  teleop: { type: "hand-tracking" }, // ← New teleoperator type
  calibrationData: calibrationData,
  onStateUpdate: (state) => {
    console.log(`Hand tracking active: ${state.isActive}`);
    console.log(`Detected gestures: ${state.detectedGestures}`);
  },
});

// Start hand tracking teleoperation
teleoperationProcess.start();

// Hand movements automatically control robot
// - Move index finger → robot end effector follows in X/Y
// - Pinch thumb-index → robot extends/retracts (Z-axis)
// - Rotate wrist → gripper rotates
// - Open/close pinch → gripper opens/closes
```

### Component Integration (Cyberpunk Example)

```typescript
// In teleoperation view - same pattern as keyboard/gamepad
const [selectedTeleopType, setSelectedTeleopType] = useState<TeleopType>("keyboard");
const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

// Teleoperator selector
<select value={selectedTeleopType} onChange={(e) => setSelectedTeleopType(e.target.value)}>
  <option value="keyboard">Keyboard</option>
  <option value="gamepad">Gamepad</option>
  <option value="hand-tracking">Hand Tracking</option> {/* ← New option */}
</select>

// Activate button
<button onClick={() => activateTeleoperation()}>
  Activate {selectedTeleopType === "hand-tracking" ? "Hand Tracking" : "Control"}
</button>

// Video feed (when hand tracking active)
{selectedTeleopType === "hand-tracking" && (
  <div className="hand-tracking-feed">
    <video ref={videoRef} autoPlay playsInline />
    <canvas ref={canvasRef} /> {/* Keypoint overlay */}
  </div>
)}
```

### Hand Gesture Mapping

```typescript
// Hand tracking teleoperator - maps gestures to motor positions
interface HandGesture {
  indexTip: { x: number; y: number }; // Planar position
  thumbTip: { x: number; y: number };
  thumbIndexDistance: number; // Gripper control
  wristRotation: number; // Gripper angle
  pinkyThumbDistance: number; // Wrist flex detection
}

// Mapping configuration (device-specific)
interface HandTrackingMapping {
  // Position mapping
  cameraToControlScale: number; // Buffer zone (0.7 = 70% center maps to full range)
  zRangeMin: number; // Minimum arm extension
  zRangeMax: number; // Maximum arm extension

  // Gesture thresholds
  pinchThreshold: number; // Distance for gripper activation
  touchThreshold: number; // Distance for rotation activation

  // Smoothing
  positionSmoothing: number; // IIR filter coefficient
  gestureSmoothing: number; // Gesture detection smoothing
}
```

## Implementation Details

### File Structure

```
packages/web/src/
├── teleoperators/
│   ├── base-teleoperator.ts           # Existing base class
│   ├── keyboard-teleoperator.ts       # Existing keyboard implementation
│   ├── hand-tracking-teleoperator.ts  # NEW: Hand tracking implementation
│   └── hand-tracking/                 # NEW: Hand tracking utilities
│       ├── detector.ts                # TensorFlow hand pose detection wrapper
│       ├── gesture-mapper.ts          # Hand gestures → robot positions
│       ├── smoothing.ts               # Smoothed detection for stability
│       └── visualization.ts           # Canvas overlay rendering
├── types/
│   └── hand-tracking.ts               # NEW: Hand tracking types
└── teleoperate.ts                     # Update to support hand tracking type

examples/cyberpunk-standalone/src/
├── components/
│   └── teleoperation-view.tsx         # UPDATE: Add hand tracking option + webcam
└── hooks/
    └── use-camera-stream.ts           # NEW: Reusable webcam management
```

### Core Dependencies

```json
{
  "dependencies": {
    "@tensorflow/tfjs-core": "^4.x",
    "@tensorflow/tfjs-backend-webgl": "^4.x",
    "@tensorflow-models/hand-pose-detection": "^2.x"
  }
}
```

### Hand Tracking Teleoperator Implementation

```typescript
// teleoperators/hand-tracking-teleoperator.ts
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import { BaseWebTeleoperator } from "./base-teleoperator.js";
import { HandTrackingDetector } from "./hand-tracking/detector.js";
import { HandGestureMapper } from "./hand-tracking/gesture-mapper.js";
import type {
  MotorConfig,
  TeleoperationState,
} from "../types/teleoperation.js";
import type { HandTrackingConfig } from "../types/hand-tracking.js";

export class HandTrackingTeleoperator extends BaseWebTeleoperator {
  private detector: HandTrackingDetector;
  private mapper: HandGestureMapper;
  private videoElement: HTMLVideoElement;
  private mediaStream: MediaStream;
  private detectionFrameId: number | null = null;
  private config: HandTrackingConfig;

  // Current hand state for visualization
  public handKeypoints: any = {};
  public detectedGestures: string[] = [];

  constructor(
    motorConfigs: MotorConfig[],
    videoElement: HTMLVideoElement,
    mediaStream: MediaStream,
    config: HandTrackingConfig
  ) {
    super(motorConfigs);
    this.videoElement = videoElement;
    this.mediaStream = mediaStream;
    this.config = config;

    this.detector = new HandTrackingDetector();
    this.mapper = new HandGestureMapper(motorConfigs, config);
  }

  async initialize(): Promise<void> {
    await this.detector.initialize();
  }

  start(): void {
    this.isActive = true;
    this.startDetectionLoop();
  }

  stop(): void {
    this.isActive = false;
    if (this.detectionFrameId) {
      cancelAnimationFrame(this.detectionFrameId);
      this.detectionFrameId = null;
    }
  }

  private async startDetectionLoop(): Promise<void> {
    if (!this.isActive) return;

    // Detect hand pose
    const hands = await this.detector.detectHands(this.videoElement);

    if (hands && hands.length > 0) {
      // Extract hand keypoints
      this.handKeypoints = this.detector.extractKeypoints(hands[0]);

      // Map gestures to motor positions
      const motorPositions = this.mapper.mapGesturesToMotors(
        this.handKeypoints
      );

      // Update detected gestures for UI
      this.detectedGestures = this.mapper.getActiveGestures();

      // Update motor positions
      this.updateMotorPositions(motorPositions);
    }

    // Continue detection loop
    this.detectionFrameId = requestAnimationFrame(() =>
      this.startDetectionLoop()
    );
  }

  private updateMotorPositions(positions: Record<string, number>): void {
    // Update motorConfigs with new positions
    for (const motor of this.motorConfigs) {
      if (positions[motor.name] !== undefined) {
        motor.current_position = positions[motor.name];
      }
    }

    // Send updated positions to robot
    this.sendMotorPositions();
  }

  async cleanup(): Promise<void> {
    this.stop();
    await this.detector.dispose();
    this.mediaStream.getTracks().forEach((track) => track.stop());
  }

  getState(): TeleoperationState {
    return {
      isActive: this.isActive,
      motorPositions: this.motorConfigs.map((m) => ({
        name: m.name,
        position: m.current_position,
      })),
      handKeypoints: this.handKeypoints,
      detectedGestures: this.detectedGestures,
    };
  }
}
```

### TensorFlow Hand Detector Wrapper

```typescript
// teleoperators/hand-tracking/detector.ts
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";

export class HandTrackingDetector {
  private detector: handPoseDetection.HandDetector | null = null;

  async initialize(): Promise<void> {
    await tf.ready();
    await tf.setBackend("webgl");

    const model = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig: handPoseDetection.MediaPipeHandsMediaPipeModelConfig =
      {
        runtime: "mediapipe",
        solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
        maxHands: 1,
        modelType: "full",
      };

    this.detector = await handPoseDetection.createDetector(
      model,
      detectorConfig
    );
  }

  async detectHands(video: HTMLVideoElement): Promise<any[]> {
    if (!this.detector) return [];
    return await this.detector.estimateHands(video);
  }

  extractKeypoints(hand: any): Record<string, { x: number; y: number }> {
    const keypoints: Record<string, { x: number; y: number }> = {};

    for (const kp of hand.keypoints) {
      keypoints[kp.name] = { x: kp.x, y: kp.y };
    }

    return keypoints;
  }

  async dispose(): Promise<void> {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
  }
}
```

### Gesture to Motor Mapping

```typescript
// teleoperators/hand-tracking/gesture-mapper.ts
import type { MotorConfig } from "../../types/teleoperation.js";
import type { HandTrackingConfig } from "../../types/hand-tracking.js";

export class HandGestureMapper {
  private motorConfigs: MotorConfig[];
  private config: HandTrackingConfig;
  private smoothedPosition: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };
  private activeGestures: string[] = [];

  constructor(motorConfigs: MotorConfig[], config: HandTrackingConfig) {
    this.motorConfigs = motorConfigs;
    this.config = config;
  }

  mapGesturesToMotors(
    keypoints: Record<string, { x: number; y: number }>
  ): Record<string, number> {
    this.activeGestures = [];
    const motorPositions: Record<string, number> = {};

    // Extract key hand points
    const indexTip = keypoints["index_finger_tip"];
    const thumbTip = keypoints["thumb_tip"];
    const wrist = keypoints["wrist"];

    if (!indexTip || !thumbTip || !wrist) return motorPositions;

    // 1. Planar position from index finger (X, Y)
    const normalizedX = this.normalizePosition(indexTip.x, "x");
    const normalizedY = this.normalizePosition(indexTip.y, "y");

    this.smoothedPosition.x = this.smooth(this.smoothedPosition.x, normalizedX);
    this.smoothedPosition.y = this.smooth(this.smoothedPosition.y, normalizedY);

    // 2. Z-axis from thumb-index pinch distance
    const pinchDistance = this.calculateDistance(thumbTip, indexTip);
    const normalizedZ = this.normalizePinchDistance(pinchDistance);
    this.smoothedPosition.z = this.smooth(this.smoothedPosition.z, normalizedZ);

    if (this.isPinching(pinchDistance)) {
      this.activeGestures.push("pinch");
    }

    // 3. Map to SO-100 motors using inverse kinematics
    const ikResult = this.planarToMotors(
      this.smoothedPosition.x,
      this.smoothedPosition.y,
      this.smoothedPosition.z
    );

    // 4. Gripper control from thumb-index distance
    const gripperMouth = this.mapGripperMouth(pinchDistance);
    motorPositions["gripper"] = gripperMouth;

    // 5. Wrist rotation from hand orientation
    const wristRotation = this.calculateWristRotation(keypoints);
    motorPositions["wrist_roll"] = wristRotation;

    return { ...motorPositions, ...ikResult };
  }

  private normalizePosition(value: number, axis: "x" | "y"): number {
    // Map camera coordinates to [-1, 1] with buffer zone
    const scale = this.config.cameraToControlScale || 0.7;
    // Implementation details...
    return 0; // Normalized value
  }

  private calculateDistance(
    p1: { x: number; y: number },
    p2: { x: number; y: number }
  ): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private smooth(current: number, target: number): number {
    const alpha = this.config.positionSmoothing || 0.3;
    return current * (1 - alpha) + target * alpha;
  }

  private planarToMotors(
    x: number,
    y: number,
    z: number
  ): Record<string, number> {
    // Inverse kinematics for SO-100
    // Convert planar coordinates to motor positions
    return {
      shoulder_pan: 0,
      shoulder_lift: 0,
      elbow_flex: 0,
      wrist_flex: 0,
    };
  }

  private isPinching(distance: number): boolean {
    return distance < (this.config.pinchThreshold || 50);
  }

  private mapGripperMouth(distance: number): number {
    // Map pinch distance to gripper opening angle
    return 0; // Motor position
  }

  private calculateWristRotation(
    keypoints: Record<string, { x: number; y: number }>
  ): number {
    // Calculate wrist rotation from hand orientation
    return 0; // Motor position
  }

  getActiveGestures(): string[] {
    return this.activeGestures;
  }
}
```

### Teleoperate Function Update

```typescript
// teleoperate.ts - Add hand tracking support
import { HandTrackingTeleoperator } from "./teleoperators/hand-tracking-teleoperator.js";

export async function teleoperate(
  config: TeleoperateConfig
): Promise<TeleoperationProcess> {
  // ... existing code ...

  if (config.teleop.type === "hand-tracking") {
    if (!config.teleop.videoElement || !config.teleop.mediaStream) {
      throw new Error("Hand tracking requires videoElement and mediaStream");
    }

    teleoperator = new HandTrackingTeleoperator(
      motorConfigs,
      config.teleop.videoElement,
      config.teleop.mediaStream,
      config.teleop.handTrackingConfig || {}
    );
  }

  // ... rest of implementation ...
}
```

### Cyberpunk Example Integration

```typescript
// examples/cyberpunk-standalone/src/components/teleoperation-view.tsx

// Add camera stream state
const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
const [cameraError, setCameraError] = useState<string | null>(null);
const videoRef = useRef<HTMLVideoElement>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);

// Request camera when hand tracking selected
const requestCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 640, height: 480 },
    });
    setCameraStream(stream);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  } catch (error) {
    setCameraError("Camera access denied");
  }
};

// Initialize teleoperation with hand tracking
const initTeleoperation = async () => {
  const process = await teleoperate({
    robot,
    teleop: {
      type: selectedTeleopType,
      videoElement:
        selectedTeleopType === "hand-tracking" ? videoRef.current! : undefined,
      mediaStream:
        selectedTeleopType === "hand-tracking" ? cameraStream! : undefined,
      handTrackingConfig: {
        cameraToControlScale: 0.7,
        zRangeMin: 0.4,
        zRangeMax: 2.4,
        positionSmoothing: 0.3,
      },
    },
    calibrationData,
    onStateUpdate: (state) => {
      setTeleoperationState(state);

      // Render hand keypoints on canvas
      if (selectedTeleopType === "hand-tracking" && canvasRef.current) {
        renderHandKeypoints(canvasRef.current, state.handKeypoints);
      }
    },
  });

  teleoperationProcessRef.current = process;
};

// UI rendering
<div className="teleoperation-container">
  {/* Teleoperator selector */}
  <select value={selectedTeleopType} onChange={handleTeleopTypeChange}>
    <option value="keyboard">Keyboard</option>
    <option value="hand-tracking">Hand Tracking</option>
  </select>

  {/* Camera feed for hand tracking */}
  {selectedTeleopType === "hand-tracking" && (
    <div className="hand-tracking-view">
      <video ref={videoRef} autoPlay playsInline className="camera-feed" />
      <canvas ref={canvasRef} className="keypoint-overlay" />

      {teleoperationState?.detectedGestures && (
        <div className="gestures">
          Active: {teleoperationState.detectedGestures.join(", ")}
        </div>
      )}
    </div>
  )}

  {/* Activate button */}
  <button onClick={handleActivate}>
    {selectedTeleopType === "hand-tracking"
      ? "Start Hand Tracking"
      : "Activate"}
  </button>
</div>;
```

### Canvas Visualization

```typescript
// teleoperators/hand-tracking/visualization.ts
export function renderHandKeypoints(
  canvas: HTMLCanvasElement,
  keypoints: Record<string, { x: number; y: number }>
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear previous frame
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw index finger tip (blue)
  if (keypoints["index_finger_tip"]) {
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.arc(
      keypoints["index_finger_tip"].x,
      keypoints["index_finger_tip"].y,
      8,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }

  // Draw thumb tip (orange)
  if (keypoints["thumb_tip"]) {
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(
      keypoints["thumb_tip"].x,
      keypoints["thumb_tip"].y,
      8,
      0,
      2 * Math.PI
    );
    ctx.fill();
  }

  // Draw connection line when pinching
  if (keypoints["index_finger_tip"] && keypoints["thumb_tip"]) {
    const distance = Math.sqrt(
      Math.pow(keypoints["thumb_tip"].x - keypoints["index_finger_tip"].x, 2) +
        Math.pow(keypoints["thumb_tip"].y - keypoints["index_finger_tip"].y, 2)
    );

    if (distance < 50) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(
        keypoints["index_finger_tip"].x,
        keypoints["index_finger_tip"].y
      );
      ctx.lineTo(keypoints["thumb_tip"].x, keypoints["thumb_tip"].y);
      ctx.stroke();
    }
  }
}
```

## Technical Considerations

### Platform Separation

Hand tracking is **browser-only** due to dependencies on:

- WebGL backend for TensorFlow.js
- WebRTC camera access via `navigator.mediaDevices`
- Canvas API for visualization
- MediaStream API

**Never attempt to implement hand tracking in Node.js package.**

### Performance Optimization

- Use WebGL backend for GPU acceleration
- Limit hand detection to 1 hand (sufficient for teleoperation)
- Use `requestAnimationFrame` for smooth rendering
- Apply smoothing to reduce jitter from detection noise
- Separate detection loop from motor update frequency

### Device Configuration

```typescript
// SO-100 hand tracking configuration
const SO100_HAND_TRACKING_CONFIG: HandTrackingConfig = {
  cameraToControlScale: 0.7, // 70% center buffer
  zRangeMin: 0.4, // rem units
  zRangeMax: 2.4,
  positionSmoothing: 0.3, // IIR filter alpha
  gestureSmoothing: 0.2,
  pinchThreshold: 50, // pixels
  touchThreshold: 30,
};
```

### Error Handling

```typescript
// Camera access errors
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
} catch (error) {
  if (error.name === "NotAllowedError") {
    throw new Error("Camera permission denied");
  } else if (error.name === "NotFoundError") {
    throw new Error("No camera found");
  } else {
    throw new Error(`Camera error: ${error.message}`);
  }
}

// TensorFlow initialization errors
try {
  await detector.initialize();
} catch (error) {
  throw new Error("Failed to load hand tracking model");
}
```

### Resource Cleanup

```typescript
// Clean up TensorFlow resources
await teleoperator.cleanup(); // Disposes detector
detector.dispose(); // Releases GPU memory
mediaStream.getTracks().forEach((track) => track.stop()); // Releases camera
```

## Definition of Done

### Phase 1: Core Hand Tracking

- [ ] **HandTrackingTeleoperator**: Implemented with TensorFlow hand pose detection
- [ ] **Gesture Mapping**: Hand keypoints → SO-100 motor positions
- [ ] **Detection Loop**: Real-time hand tracking at 30+ FPS
- [ ] **Smoothing**: Position and gesture smoothing for stable control
- [ ] **Resource Management**: Proper cleanup of TensorFlow models and streams

### Phase 2: UI Integration

- [ ] **Teleoperation View**: Hand tracking option in teleoperator selector
- [ ] **Camera Access**: Webcam permission request and stream management
- [ ] **Video Display**: Live camera feed with hand tracking active
- [ ] **Canvas Overlay**: Real-time hand keypoint visualization
- [ ] **Gesture Feedback**: Display active gestures in UI

### Phase 3: Configuration & Polish

- [ ] **Device Config**: SO-100 specific hand tracking configuration
- [ ] **Error Handling**: Clear error messages for camera/model failures
- [ ] **Settings UI**: Adjustable buffer zones, smoothing, thresholds
- [ ] **Documentation**: Hand tracking setup and usage examples
- [ ] **TypeScript**: Full type coverage for hand tracking types

### Success Criteria

- [ ] **Natural Control**: Hand movements smoothly control robot arm
- [ ] **Responsive**: Low latency between hand movement and robot response
- [ ] **Stable**: Smoothing prevents jitter and unintended movements
- [ ] **Intuitive**: Users can control robot after brief demonstration
- [ ] **Reliable**: Handles lighting conditions and hand orientations well
- [ ] **No Regression**: Existing keyboard/gamepad teleoperation unaffected

## Future Enhancements

### Advanced Gestures

- Two-hand control for simultaneous leader/follower manipulation
- Pinch-and-twist for combined gripper and rotation control
- Gesture shortcuts (thumbs up = save position, peace sign = reset)
- Dynamic gesture learning for custom control mappings

### Improved Mapping

- Full 6-DOF inverse kinematics for complex movements
- Physics-based constraints to prevent impossible poses
- Adaptive smoothing based on movement speed
- Collision avoidance using hand proximity detection

### UI Improvements

- AR overlay showing robot's target position
- Visual guides for optimal hand positioning
- Gesture training mode with feedback
- Recording of hand trajectories for replay

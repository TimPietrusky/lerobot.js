import type { MotorConfig } from "../../types/teleoperation.js";
import type {
  HandTrackingConfig,
  HandKeypoints,
} from "../../types/hand_tracking.js";

export class HandGestureMapper {
  private motorConfigs: MotorConfig[];
  private config: HandTrackingConfig;
  private smoothedPosition: { x: number; y: number; z: number } = {
    x: 0,
    y: 0,
    z: 0,
  };
  private activeGestures: string[] = [];
  private lastMotorPositions: Record<string, number> = {};
  private lastKeypoints: HandKeypoints = {};
  private lastPinchDistance: number = 0;
  private videoWidth: number = 640; // Default, will be updated
  private videoHeight: number = 480; // Default, will be updated

  constructor(motorConfigs: MotorConfig[], config: HandTrackingConfig) {
    this.motorConfigs = motorConfigs;
    this.config = config;
  }

  setVideoResolution(width: number, height: number): void {
    this.videoWidth = width;
    this.videoHeight = height;
  }

  mapGesturesToMotors(keypoints: HandKeypoints): Record<string, number> {
    this.activeGestures = [];
    const motorPositions: Record<string, number> = {};
    this.lastKeypoints = keypoints;

    const indexTip = keypoints["index_finger_tip"];
    const thumbTip = keypoints["thumb_tip"];
    const wrist = keypoints["wrist"];

    if (!indexTip || !thumbTip || !wrist) return motorPositions;

    // Map hand position to planar coordinates (X, Y, Z)
    const normalizedX = -this.normalizePosition(indexTip.x, "x"); // Invert X so right is positive
    const normalizedY = this.normalizePosition(indexTip.y, "y"); // No inversion needed here

    // Z-axis from pinch distance (thumb to index)
    const pinchDistance = this.calculateDistance(thumbTip, indexTip);
    this.lastPinchDistance = pinchDistance;
    const normalizedZ = this.normalizePinchDistance(pinchDistance);

    this.smoothedPosition.x = this.smooth(this.smoothedPosition.x, normalizedX);
    this.smoothedPosition.y = this.smooth(this.smoothedPosition.y, normalizedY);
    this.smoothedPosition.z = this.smooth(this.smoothedPosition.z, normalizedZ);

    // Use inverse kinematics to map hand position to multiple motors
    const ikMotors = this.planarToMotors(
      this.smoothedPosition.x,
      this.smoothedPosition.y,
      this.smoothedPosition.z
    );

    Object.assign(motorPositions, ikMotors);
    this.activeGestures.push("hand_position");

    this.lastMotorPositions = motorPositions;
    return this.lastMotorPositions;
  }

  private normalizePosition(value: number, axis: "x" | "y"): number {
    const scale = this.config.cameraToControlScale || 0.7;

    // Use actual video dimensions instead of hardcoded values
    const maxValue = axis === "x" ? this.videoWidth : this.videoHeight;
    const center = maxValue / 2;
    const normalized = (value - center) / center;

    return Math.max(-1, Math.min(1, normalized / scale));
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

  private normalizePinchDistance(distance: number): number {
    const minDistance = 10;
    const maxDistance = 150;
    const normalized = (distance - minDistance) / (maxDistance - minDistance);
    return Math.max(0, Math.min(1, normalized));
  }

  private planarToMotors(
    x: number,
    y: number,
    z: number
  ): Record<string, number> {
    const ARM_LENGTH_1 = 210;
    const ARM_LENGTH_2 = 200;

    // Decoupled control: X controls shoulder_pan, Y controls shoulder_lift, Z extends reach
    const motorRange = 3500 - 500;
    const motorCenter = 500 + motorRange / 2;

    // X-axis: directly map to shoulder_pan (left/right rotation)
    const shoulderPan = motorCenter + x * (motorRange / 2);

    // Y-axis: directly map to shoulder_lift (up/down movement)
    const shoulderLift = motorCenter + y * (motorRange / 2);

    // Z-axis (pinch): controls elbow extension for reach
    const elbowFlex = motorCenter + z * (motorRange / 2);

    // Wrist flex stays centered by default
    const wristFlex = 2047;

    return {
      shoulder_pan: Math.round(Math.max(500, Math.min(3500, shoulderPan))),
      shoulder_lift: Math.round(Math.max(500, Math.min(3500, shoulderLift))),
      elbow_flex: Math.round(Math.max(500, Math.min(3500, elbowFlex))),
      wrist_flex: Math.round(Math.max(500, Math.min(3500, wristFlex))),
    };
  }

  private isPinching(distance: number): boolean {
    return distance < (this.config.pinchThreshold || 50);
  }

  private mapGripperMouth(distance: number): number {
    const minOpen = 0;
    const maxOpen = 120;
    const minDistance = 10;
    const maxDistance = 100;

    const normalized = (distance - minDistance) / (maxDistance - minDistance);
    const clamped = Math.max(0, Math.min(1, normalized));

    return minOpen + clamped * (maxOpen - minOpen);
  }

  private calculateWristRotation(keypoints: HandKeypoints): number {
    const thumbTip = keypoints["thumb_tip"];
    const middleFingerMcp = keypoints["middle_finger_mcp"];
    const indexTip = keypoints["index_finger_tip"];

    if (!thumbTip || !middleFingerMcp || !indexTip) {
      return 2047;
    }

    const v1 = {
      x: thumbTip.x - middleFingerMcp.x,
      y: thumbTip.y - middleFingerMcp.y,
    };
    const v2 = {
      x: indexTip.x - middleFingerMcp.x,
      y: indexTip.y - middleFingerMcp.y,
    };

    let angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
    angle = ((angle * 180) / Math.PI + 360) % 360;

    return 2047 + ((angle - 180) / 180) * 2048;
  }

  getActiveGestures(): string[] {
    return this.activeGestures;
  }

  getDebugInfo() {
    return {
      motorPositions: this.lastMotorPositions,
      smoothedPosition: this.smoothedPosition,
      pinchDistance: this.lastPinchDistance,
      keypoints: this.lastKeypoints,
    };
  }
}

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

  constructor(motorConfigs: MotorConfig[], config: HandTrackingConfig) {
    this.motorConfigs = motorConfigs;
    this.config = config;
  }

  mapGesturesToMotors(keypoints: HandKeypoints): Record<string, number> {
    this.activeGestures = [];
    const motorPositions: Record<string, number> = {};
    this.lastKeypoints = keypoints;

    const indexTip = keypoints["index_finger_tip"];
    const thumbTip = keypoints["thumb_tip"];
    const wrist = keypoints["wrist"];

    if (!indexTip || !thumbTip || !wrist) return motorPositions;

    // CALIBRATION MODE: Map hand X/Y position to shoulder_pan and shoulder_lift
    const normalizedX = this.normalizePosition(indexTip.x, "x");
    const normalizedY = this.normalizePosition(indexTip.y, "y");

    this.smoothedPosition.x = this.smooth(this.smoothedPosition.x, normalizedX);
    this.smoothedPosition.y = this.smooth(this.smoothedPosition.y, normalizedY);

    // Map X position to shoulder_pan (range: 500-3500)
    const motorRange = 3500 - 500;
    const motorCenter = 500 + motorRange / 2;
    const motorValueX =
      motorCenter + this.smoothedPosition.x * (motorRange / 2);
    motorPositions["shoulder_pan"] = Math.max(500, Math.min(3500, motorValueX));

    // Map Y position to shoulder_lift (range: 500-3500)
    const motorValueY =
      motorCenter + this.smoothedPosition.y * (motorRange / 2);
    motorPositions["shoulder_lift"] = Math.max(
      500,
      Math.min(3500, motorValueY)
    );

    this.activeGestures.push("hand_position");

    this.lastMotorPositions = motorPositions;
    return this.lastMotorPositions;
  }

  private normalizePosition(value: number, axis: "x" | "y"): number {
    const scale = this.config.cameraToControlScale || 0.7;
    const normalized = (value - 320) / 320;
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

    const targetX = x * 300;
    const targetY = y * 300 + 100;

    const d = Math.sqrt(targetX * targetX + targetY * targetY);

    if (
      d > ARM_LENGTH_1 + ARM_LENGTH_2 ||
      d < Math.abs(ARM_LENGTH_1 - ARM_LENGTH_2)
    ) {
      return {
        shoulder_pan: 2047,
        shoulder_lift: 2047,
        elbow_flex: 2047,
        wrist_flex: 2047,
      };
    }

    const angle2Cos =
      (d * d - ARM_LENGTH_1 * ARM_LENGTH_1 - ARM_LENGTH_2 * ARM_LENGTH_2) /
      (2 * ARM_LENGTH_1 * ARM_LENGTH_2);
    const angle2 = Math.acos(Math.max(-1, Math.min(1, angle2Cos)));

    const k1 = ARM_LENGTH_1 + ARM_LENGTH_2 * Math.cos(angle2);
    const k2 = ARM_LENGTH_2 * Math.sin(angle2);
    const angle1 = Math.atan2(targetY, targetX) - Math.atan2(k2, k1);

    const shoulderPan = 2047 + ((angle1 * 180) / Math.PI) * (2048 / 180);
    const shoulderLift = 2047 - (((angle2 * 180) / Math.PI) * (2048 / 180)) / 2;
    const elbowFlex = 2047 + ((angle2 * 180) / Math.PI) * (2048 / 180);

    const zRange =
      (this.config.zRangeMax || 2.4) - (this.config.zRangeMin || 0.4);
    const wristFlex = 2047 + (z * zRange - 1.2) * (2048 / 3.6);

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

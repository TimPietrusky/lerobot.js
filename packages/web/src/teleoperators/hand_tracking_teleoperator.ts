import { BaseWebTeleoperator } from "./base-teleoperator.js";
import { HandTrackingDetector } from "./hand_tracking/detector.js";
import { HandGestureMapper } from "./hand_tracking/gesture_mapper.js";
import type {
  MotorConfig,
  TeleoperationState,
} from "../types/teleoperation.js";
import type {
  HandTrackingConfig,
  HandKeypoints,
} from "../types/hand_tracking.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";
import { writeMotorPosition } from "../utils/motor-communication.js";

export class HandTrackingTeleoperator extends BaseWebTeleoperator {
  private detector: HandTrackingDetector;
  private mapper: HandGestureMapper;
  private videoElement: HTMLVideoElement;
  private mediaStream: MediaStream;
  private detectionFrameId: number | null = null;
  private config: HandTrackingConfig;
  public handKeypoints: HandKeypoints = {};
  public detectedGestures: string[] = [];

  constructor(
    port: MotorCommunicationPort,
    motorConfigs: MotorConfig[],
    videoElement: HTMLVideoElement,
    mediaStream: MediaStream,
    config: HandTrackingConfig
  ) {
    super(port, motorConfigs);
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

    const hands = await this.detector.detectHands(this.videoElement);

    // Set video resolution on mapper (only needs to happen once, but no harm in checking)
    if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
      this.mapper.setVideoResolution(
        this.videoElement.videoWidth,
        this.videoElement.videoHeight
      );
    }

    if (hands && hands.length > 0) {
      this.handKeypoints = this.detector.extractKeypoints(hands[0]);

      const motorPositions = this.mapper.mapGesturesToMotors(
        this.handKeypoints
      );

      this.detectedGestures = this.mapper.getActiveGestures();

      await this.updateMotorPositions(motorPositions);
    }

    this.detectionFrameId = requestAnimationFrame(() =>
      this.startDetectionLoop()
    );
  }

  private async updateMotorPositions(
    positions: Record<string, number>
  ): Promise<void> {
    // Update all motors from inverse kinematics: shoulder_pan, shoulder_lift, elbow_flex, wrist_flex
    const motorNames = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
    ];

    for (const motorName of motorNames) {
      const motor = this.motorConfigs.find((m) => m.name === motorName);

      if (!motor || positions[motorName] === undefined) {
        continue;
      }

      const newPosition = positions[motorName];

      // Clamp position to valid range
      const clampedPosition = Math.max(
        motor.minPosition,
        Math.min(motor.maxPosition, newPosition)
      );

      // Only send if position changed significantly (avoid jitter from small changes)
      const positionDiff = Math.abs(clampedPosition - motor.currentPosition);
      if (positionDiff > 5) {
        try {
          await writeMotorPosition(
            this.port,
            motor.id,
            Math.round(clampedPosition)
          );
          motor.currentPosition = clampedPosition;
        } catch (error) {
          console.warn(`Failed to write motor ${motorName}:`, error);
        }
      }
    }
  }

  async cleanup(): Promise<void> {
    this.stop();
    await this.detector.dispose();
    this.mediaStream.getTracks().forEach((track) => track.stop());
  }

  getState(): Record<string, any> {
    return {
      isActive: this.isActive,
      handKeypoints: this.handKeypoints,
      detectedGestures: this.detectedGestures,
    };
  }

  getDebugInfo() {
    return this.mapper.getDebugInfo();
  }
}

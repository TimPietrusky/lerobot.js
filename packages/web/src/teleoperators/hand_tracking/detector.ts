import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import type { HandKeypoints } from "../../types/hand_tracking.js";

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

  extractKeypoints(hand: any): HandKeypoints {
    const keypoints: HandKeypoints = {};

    for (const kp of hand.keypoints) {
      keypoints[kp.name] = {
        x: kp.x,
        y: kp.y,
        z: kp.z,
        name: kp.name,
      };
    }

    return keypoints;
  }

  async dispose(): Promise<void> {
    if (this.detector) {
      this.detector.dispose();
      this.detector = null;
    }
    await tf.disposeVariables();
  }
}

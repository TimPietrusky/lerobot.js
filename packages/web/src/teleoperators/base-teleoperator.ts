/**
 * Base teleoperator interface and abstract class for Web platform
 * Defines the contract that all teleoperators must implement
 */

import type { MotorConfig } from "../types/teleoperation.js";
import type { MotorCommunicationPort } from "../utils/motor-communication.js";

/**
 * Normalizes a value from one range to another
 * @param value The value to normalize
 * @param minVal The minimum value of the original range
 * @param maxVal The maximum value of the original range
 * @param minNorm The minimum value of the normalized range
 * @param maxNorm The maximum value of the normalized range
 * @returns The normalized value
 */
function normalizeValue(value: number, minVal: number, maxVal: number, minNorm: number, maxNorm: number): number {
  const range = maxVal - minVal;
  const normRange = maxNorm - minNorm;
  const normalized = (value - minVal) / range;
  return normalized * normRange + minNorm;
}

/**
 * Base interface that all Web teleoperators must implement
 */
export abstract class WebTeleoperator extends EventTarget {
  abstract recordedMotorPositions: any;
  abstract initialize(): Promise<void>;
  abstract start(): void;
  abstract stop(): void;

  abstract recordingTaskIndex : number;
  abstract recordingEpisodeIndex : number;
  abstract startRecording(): void;
  abstract stopRecording(): any;
  abstract setEpisodeIndex(index: number): void;
  abstract setTaskIndex(index: number): void;
  
  abstract disconnect(): Promise<void>;
  abstract getState(): TeleoperatorSpecificState;
  abstract onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void;
}

/**
 * Teleoperator-specific state (union type for different teleoperator types)
 */
export type TeleoperatorSpecificState = {
  keyStates?: { [key: string]: { pressed: boolean; timestamp: number } }; // keyboard
  leaderPositions?: { [motor: string]: number }; // leader arm
  gamepadState?: { axes: number[]; buttons: boolean[] }; // gamepad
};

/**
 * Base abstract class with common functionality for all teleoperators
 */
export abstract class BaseWebTeleoperator extends WebTeleoperator {
  protected port: MotorCommunicationPort;
  public motorConfigs: MotorConfig[] = [];
  protected isActive: boolean = false;
  public recordedMotorPositions: any;
  public isRecording: boolean = false;
  public recordingTaskIndex : number;
  public recordingEpisodeIndex : number;

  constructor(port: MotorCommunicationPort, motorConfigs: MotorConfig[]) {
    super();
    this.port = port;
    this.motorConfigs = motorConfigs;

    // utility to store all position changes asked for and planned
    this.recordedMotorPositions = [];
    this.isRecording = false;
    this.recordingTaskIndex = 0;
    this.recordingEpisodeIndex = 0;
  }

  abstract initialize(): Promise<void>;
  abstract start(): void;
  abstract stop(): void;
  abstract getState(): TeleoperatorSpecificState;

  async disconnect(): Promise<void> {
    this.stop();
    if (this.port && "close" in this.port) {
      await (this.port as any).close();
    }
  }

  /**
   * Starts recording motor positions
   */
  startRecording(): void {
    this.isRecording = true;
  }

  setEpisodeIndex(index: number): void {
    this.recordingEpisodeIndex = index;
  }

  setTaskIndex(index: number): void {
    this.recordingTaskIndex = index;
  }

  /**
   * Stops recording and returns the recorded motor positions
   * @returns The recorded motor positions
   */
  stopRecording(): any {
    this.isRecording = false;
    const recordedPositions = this.recordedMotorPositions;
    this.recordedMotorPositions = [];
    return recordedPositions;
  }

  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void {
    this.motorConfigs = motorConfigs;
  }

  /**
   * Dispatches a motor position changed event
   * Gets the motor positions, normalized
   * 
   * This follows the guide at https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/src/lerobot/robots/so100_follower/so100_follower.py#L49
   * Meaning, for everything except gripper, it normalizes the positions to between -100 and 100
   * and for gripper it normalizes between 0 - 100
   * 
   * @param motorName The name of the motor that changed
   * @param motorConfig The motor configuration
   * @param previousPosition The previous position of the motor
   * @param currentPosition The current position of the motor
   * @param timestamp The timestamp of the event
   */
  dispatchMotorPositionChanged(motorName: string, motorConfig: MotorConfig, previousPosition: number, currentPosition: number, commandSentTimestamp: number, positionChangedTimestamp: number): void {
    let minNormPosition;
    let maxNormPosition;

    /**
     * This follows the guide at https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/src/lerobot/robots/so100_follower/so100_follower.py#L49
     * Meaning, for everything except gripper, it normalizes the positions to between -100 and 100
     * and for gripper it normalizes between 0 - 100
     */
    if(["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll"].includes(motorName)) {
      minNormPosition = -100;
      maxNormPosition = 100;
    } else {
      minNormPosition = 0;
      maxNormPosition = 100;
    }

    this.dispatchEvent(new CustomEvent("motor-position-changed", {
      detail: {
        motorName,
        motorConfig,
        previousPosition,
        currentPosition,
        previousNormalizedPosition : normalizeValue(previousPosition, motorConfig.minPosition, motorConfig.maxPosition, minNormPosition, maxNormPosition),
        currentNormalizedPosition : normalizeValue(currentPosition, motorConfig.minPosition, motorConfig.maxPosition, minNormPosition, maxNormPosition),
        commandSentTimestamp,
        positionChangedTimestamp,
        episodeIndex: this.recordingEpisodeIndex,
        taskIndex: this.recordingTaskIndex,
      },
    }));

    console.log("this was called", this.isRecording, "---")
    // if recording, store the changes
    if(this.isRecording) {
      this.recordedMotorPositions.push({
        motorName,
        motorConfig,
        previousPosition,
        currentPosition,
        previousNormalizedPosition : normalizeValue(previousPosition, motorConfig.minPosition, motorConfig.maxPosition, minNormPosition, maxNormPosition),
        currentNormalizedPosition : normalizeValue(currentPosition, motorConfig.minPosition, motorConfig.maxPosition, minNormPosition, maxNormPosition),
        commandSentTimestamp,
        positionChangedTimestamp,
      });
    }
  }

  get isActiveTeleoperator(): boolean {
    return this.isActive;
  }
}

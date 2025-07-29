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
  public motorConfigs: MotorConfig[] = [];
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
  public isRecording: boolean = false;
  public recordingTaskIndex : number;
  public recordingEpisodeIndex : number;
  public recordedMotorPositionEpisodes : any[];

  constructor(port: MotorCommunicationPort, motorConfigs: MotorConfig[]) {
    super();
    this.port = port;
    this.motorConfigs = motorConfigs;

    // store episode positions
    this.recordedMotorPositionEpisodes = []

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

    // send a frame with the current view and actions, with the same
    // observation.state and action.state
    // when starting to record, to ensure that the complete
    // data is present until the end
    this.dispatchMotorPositionChanged(this.motorConfigs, this.motorConfigs, performance.now()/1000, performance.now()/1000)
  }

  setEpisodeIndex(index: number): void {
    this.recordingEpisodeIndex = index;

    // create a new empty array at that position on the array
    this.recordedMotorPositionEpisodes[this.recordingEpisodeIndex] = []
  }

  setTaskIndex(index: number): void {
    this.recordingTaskIndex = index;
  }

  /**
   * Stops recording and returns the recorded motor positions
   * @returns The recorded motor positions
   */
  stopRecording(): any {
    // add an episode in the end while stopping recording to ensure that
    // we have data till the end time
    this.dispatchMotorPositionChanged(this.motorConfigs, this.motorConfigs, performance.now()/1000, performance.now()/1000)

    this.isRecording = false;
    const recordedEpisodes = this.recordedMotorPositionEpisodes;
    this.recordedMotorPositionEpisodes = []
    return recordedEpisodes;
  }

  onMotorConfigsUpdate(motorConfigs: MotorConfig[]): void {
    this.motorConfigs = motorConfigs;
  }

  normalizeMotorConfigPosition(motorConfig: MotorConfig){
    let minNormPosition;
    let maxNormPosition;

    /**
     * This follows the guide at https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/src/lerobot/robots/so100_follower/so100_follower.py#L49
     * Meaning, for everything except gripper, it normalizes the positions to between -100 and 100
     * and for gripper it normalizes between 0 - 100
     */
    if(["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll"].includes(motorConfig.name)) {
      minNormPosition = -100;
      maxNormPosition = 100;
    } else {
      minNormPosition = 0;
      maxNormPosition = 100;
    }

    return normalizeValue(motorConfig.currentPosition, motorConfig.minPosition, motorConfig.maxPosition, minNormPosition, maxNormPosition)
  }

  /**
   * Normalize an entire list of motor configurations
   * 
   * This follows the guide at https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/src/lerobot/robots/so100_follower/so100_follower.py#L49
   * Meaning, for everything except gripper, it normalizes the positions to between -100 and 100
   * and for gripper it normalizes between 0 - 100
   */
  normalizeMotorConfigs(motorConfigs : MotorConfig[]){
    let normalizedValues : { [key: string]: number} = {};

    for(let config of motorConfigs){
      normalizedValues[config.name] = this.normalizeMotorConfigPosition(config)
    }

    return normalizedValues
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
  dispatchMotorPositionChanged(prevMotorConfigs: MotorConfig[], newMotorConfigs: MotorConfig[], commandSentTimestamp: number, positionChangedTimestamp: number): void {
    console.log("called in", this.constructor.name)
    console.trace();
    this.dispatchEvent(new CustomEvent("motor-position-changed", {
      detail: {
        previousMotorConfigs : prevMotorConfigs,
        newMotorConfigs,
        previousMotorConfigsNormalized : this.normalizeMotorConfigs(prevMotorConfigs),
        newMotorConfigsNormalized : this.normalizeMotorConfigs(newMotorConfigs),
        commandSentTimestamp,
        positionChangedTimestamp,
        episodeIndex: this.recordingEpisodeIndex,
        taskIndex: this.recordingTaskIndex,
      },
    }));

    // if recording, store the changes
    if(this.isRecording) {
      const data = {
        previousMotorConfigs : prevMotorConfigs,
        newMotorConfigs,
        previousMotorConfigsNormalized : this.normalizeMotorConfigs(prevMotorConfigs),
        newMotorConfigsNormalized : this.normalizeMotorConfigs(newMotorConfigs),
        commandSentTimestamp,
        positionChangedTimestamp,
        episodeIndex: this.recordingEpisodeIndex,
        taskIndex: this.recordingTaskIndex,
      }

      const episodes = this.recordedMotorPositionEpisodes[this.recordingEpisodeIndex]
      episodes.push(data)
    }
  }

  get isActiveTeleoperator(): boolean {
    return this.isActive;
  }
}

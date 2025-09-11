import { WebTeleoperator } from "./teleoperators/base-teleoperator";
import { MotorConfig } from "./types/teleoperation";
import * as parquet from "parquet-wasm";
import * as arrow from "apache-arrow";
import JSZip from "jszip";
import getMetadataInfo from "./utils/record/metadataInfo";
import type { VideoInfo } from "./utils/record/metadataInfo";
import getStats from "./utils/record/stats";
import generateREADME from "./utils/record/generateREADME";
import { LeRobotHFUploader } from "./hf_uploader";
import { LeRobotS3Uploader } from "./s3_uploader";

// declare a type leRobot action that's basically an array of numbers
interface LeRobotAction {
  [key: number]: number;
}

export class LeRobotEpisode {
  // we assume that the frames are ordered
  public frames: NonIndexedLeRobotDatasetRow[];

  /**
   * Optional start time of the episode
   * If not set, defaults to the timestamp of the first frame
   */
  private _startTime?: number;

  /**
   * Optional end time of the episode
   * If not set, defaults to the timestamp of the last frame
   */
  private _endTime?: number;

  /**
   * Creates a new LeRobotEpisode
   *
   * @param frames Optional array of frames to initialize the episode with
   * @param startTime Optional explicit start time for the episode
   * @param endTime Optional explicit end time for the episode
   */
  constructor(
    frames?: NonIndexedLeRobotDatasetRow[],
    startTime?: number,
    endTime?: number
  ) {
    this.frames = frames || [];
    this._startTime = startTime;
    this._endTime = endTime;
  }

  /**
   * Adds a new frame to the episode
   * Ensures frames are always in chronological order
   *
   * @param frame The frame to add
   * @throws Error if the frame's timestamp is before the last frame's timestamp
   */
  add(frame: NonIndexedLeRobotDatasetRow) {
    const lastFrame = this.frames.at(-1);
    if (lastFrame && frame.timestamp < lastFrame.timestamp) {
      throw new Error(
        `Frame timestamp ${frame.timestamp} is before last frame timestamp ${lastFrame.timestamp}`
      );
    }
    this.frames.push(frame);
  }

  /**
   * Gets the start time of the episode
   * If not explicitly set, returns the timestamp of the first frame
   * If no frames exist, throws an error
   */
  get startTime(): number {
    if (this._startTime !== undefined) {
      return this._startTime;
    }

    const firstFrame = this.frames.at(0);
    if (!firstFrame) {
      throw new Error("Cannot determine start time: no frames in episode");
    }

    return firstFrame.timestamp;
  }

  /**
   * Sets an explicit start time for the episode
   */
  set startTime(value: number) {
    this._startTime = value;
  }

  /**
   * Gets the end time of the episode
   * If not explicitly set, returns the timestamp of the last frame
   * If no frames exist, throws an error
   */
  get endTime(): number {
    if (this._endTime !== undefined) {
      return this._endTime;
    }

    const lastFrame = this.frames.at(-1);
    if (!lastFrame) {
      throw new Error("Cannot determine end time: no frames in episode");
    }

    return lastFrame.timestamp;
  }

  /**
   * Sets an explicit end time for the episode
   */
  set endTime(value: number) {
    this._endTime = value;
  }

  /**
   * The time difference between the start and end time of the episode, in seconds
   */
  get timespan() {
    const hasNoFrames = this.frames.length === 0;
    if (hasNoFrames) return 0;

    return this.endTime - this.startTime;
  }

  /**
   * The number of frames in the episode
   */
  get length() {
    return this.frames.length;
  }

  /**
   * Creates a new LeRobotEpisode with frames interpolated at regular intervals
   *
   * @param fps The desired frames per second for the interpolated episode
   * @param startIndex The desired starting index for the episode frames, useful when storing multiple episodes
   * @returns A new LeRobotEpisode with interpolated frames
   */
  getInterpolatedRegularEpisode(
    fps: number,
    startIndex: number = 0
  ): LeRobotEpisode {
    if (this.frames.length === 0) {
      return new LeRobotEpisode([], this._startTime, this._endTime);
    }

    const actualStartTime =
      this._startTime !== undefined
        ? this._startTime
        : this.frames[0].timestamp;
    const actualEndTime =
      this._endTime !== undefined
        ? this._endTime
        : this.frames[this.frames.length - 1].timestamp;
    const timeDifference = actualEndTime - actualStartTime;

    const numFrames = Math.max(1, Math.floor(timeDifference * fps));
    const interpolatedFrames: NonIndexedLeRobotDatasetRow[] = [];

    const firstFrame = this.frames[0];
    const lastFrame = this.frames[this.frames.length - 1];

    for (let i = 0; i < numFrames; i++) {
      const timestamp = actualStartTime + i / fps;
      let frameToAdd: NonIndexedLeRobotDatasetRow;

      if (timestamp < firstFrame.timestamp) {
        frameToAdd = { ...firstFrame, timestamp };
        frameToAdd.frame_index = i;
        frameToAdd.index = startIndex + i;
      } else if (timestamp > lastFrame.timestamp) {
        frameToAdd = { ...lastFrame, timestamp };
        frameToAdd.frame_index = i;
        frameToAdd.index = startIndex + i;
      } else {
        let lowerIndex = 0;
        for (let j = 0; j < this.frames.length - 1; j++) {
          if (
            this.frames[j].timestamp <= timestamp &&
            this.frames[j + 1].timestamp > timestamp
          ) {
            lowerIndex = j;
            break;
          }
        }

        const lowerFrame = this.frames[lowerIndex];
        const upperFrame = this.frames[lowerIndex + 1];

        frameToAdd = LeRobotEpisode.interpolateFrames(
          lowerFrame,
          upperFrame,
          timestamp
        );

        frameToAdd.frame_index = i;
        frameToAdd.episode_index = lowerFrame.episode_index;
        frameToAdd.index = startIndex + i;
        frameToAdd.task_index = lowerFrame.task_index;
      }

      interpolatedFrames.push(frameToAdd);
    }

    return new LeRobotEpisode(
      interpolatedFrames,
      actualStartTime,
      actualEndTime
    );
  }

  /**
   * Interpolates between two frames to create a new frame at the specified timestamp
   *
   * @param frame1 The first frame
   * @param frame2 The second frame
   * @param targetTimestamp The timestamp at which to interpolate
   * @returns A new interpolated frame
   */
  static interpolateFrames(
    frame1: NonIndexedLeRobotDatasetRow,
    frame2: NonIndexedLeRobotDatasetRow,
    targetTimestamp: number
  ): NonIndexedLeRobotDatasetRow {
    if (
      targetTimestamp < frame1.timestamp ||
      targetTimestamp > frame2.timestamp
    ) {
      throw new Error(
        "Target timestamp must be between the timestamps of the two frames"
      );
    }

    const timeRange = frame2.timestamp - frame1.timestamp;
    const interpolationFactor =
      (targetTimestamp - frame1.timestamp) / timeRange;

    // Interpolate action array
    const interpolatedAction = LeRobotEpisode.interpolateArrays(
      frame1.action,
      frame2.action,
      interpolationFactor
    );

    // Interpolate observation.state array
    const interpolatedObservationState = LeRobotEpisode.interpolateArrays(
      frame1["observation.state"],
      frame2["observation.state"],
      interpolationFactor
    );

    // Create the interpolated frame
    return {
      timestamp: targetTimestamp,
      action: interpolatedAction,
      "observation.state": interpolatedObservationState,
      episode_index: frame1.episode_index,
      task_index: frame1.task_index,
      // Optional properties are not interpolated
      frame_index: frame1.frame_index,
      index: frame1.index,
    };
  }

  /**
   * Helper method to interpolate between two arrays
   *
   * @param array1 First array of values
   * @param array2 Second array of values
   * @param factor Interpolation factor (0-1)
   * @returns Interpolated array
   */
  private static interpolateArrays(
    array1: any,
    array2: any,
    factor: number
  ): any {
    // Handle different types of inputs
    if (Array.isArray(array1) && Array.isArray(array2)) {
      // For arrays, interpolate each element
      return array1.map((value, index) => {
        return value + (array2[index] - value) * factor;
      });
    } else if (typeof array1 === "object" && typeof array2 === "object") {
      // For objects, interpolate each property
      const result: any = {};
      for (const key of Object.keys(array1)) {
        if (key in array2) {
          result[key] = array1[key] + (array2[key] - array1[key]) * factor;
        } else {
          result[key] = array1[key];
        }
      }
      return result;
    } else {
      // For primitive values
      return array1 + (array2 - array1) * factor;
    }
  }
}

/**
 * Base interface for LeRobot dataset rows with common fields
 */
export interface NonIndexedLeRobotDatasetRow {
  timestamp: number;
  action: LeRobotAction;
  "observation.state": LeRobotAction;

  // properties are optional for back-converstion from normal rows
  episode_index: number;
  task_index: number;
  frame_index?: number;
  index?: number;
}

/**
 * Represents a complete row in the LeRobot dataset format after indexing
 * Used in the final exported dataset
 */
export interface LeRobotDatasetRow extends NonIndexedLeRobotDatasetRow {
  frame_index: number;
  index: number;
}

/**
 * A mechanism to store and record, the video of all associated cameras
 * as well as the teleoperator data
 *
 * follows the lerobot dataset format https://github.com/huggingface/lerobot/blob/cf86b9300dc83fdad408cfe4787b7b09b55f12cf/README.md#the-lerobotdataset-format
 */
export class LeRobotDatasetRecorder {
  teleoperators: WebTeleoperator[];
  videoStreams: { [key: string]: MediaStream };
  mediaRecorders: { [key: string]: MediaRecorder };
  videoChunks: { [key: string]: Blob[] };
  videoBlobs: { [key: string]: Blob };
  private videoBlobsByEpisode: {
    [episodeIndex: number]: { [key: string]: Blob };
  };
  private videoMimeByKey: { [key: string]: { mime: string; ext: string } };
  teleoperatorData: LeRobotEpisode[];
  private _isRecording: boolean;
  private episodeIndex: number = 0;
  private taskIndex: number = 0;
  private currentVideoSegmentEpisodeIndex: number | null = null;
  fps: number;
  taskDescription: string;

  /**
   * Ensures BlobPart compatibility across environments by converting Uint8Array
   * to an ArrayBuffer with correct bounds and ArrayBuffer typing.
   */
  private static toArrayBuffer(uint8: Uint8Array): ArrayBuffer {
    const buffer = uint8.buffer;
    if (buffer instanceof ArrayBuffer) {
      return buffer.slice(
        uint8.byteOffset,
        uint8.byteOffset + uint8.byteLength
      );
    }
    // Handle SharedArrayBuffer case by copying to ArrayBuffer
    const arrayBuffer = new ArrayBuffer(uint8.byteLength);
    new Uint8Array(arrayBuffer).set(uint8);
    return arrayBuffer;
  }

  constructor(
    teleoperators: WebTeleoperator[],
    videoStreams: { [key: string]: MediaStream },
    fps: number,
    taskDescription: string = "Default task description"
  ) {
    this.teleoperators = [];

    if (teleoperators.length > 1)
      throw Error(`
                Currently, only 1 teleoperator can be recorded at a time!

                Note : Do not attempt to create 2 different recorders via 2 different teleoperators, this would not work either
            `);

    this.addTeleoperator(teleoperators[0]);
    this.mediaRecorders = {};
    this.videoChunks = {};
    this.videoBlobs = {};
    this.videoBlobsByEpisode = {};
    this.videoStreams = {};
    this.videoMimeByKey = {};
    this.teleoperatorData = [];
    this._isRecording = false;
    this.fps = fps;
    this.taskDescription = taskDescription;

    for (const [key, stream] of Object.entries(videoStreams)) {
      this.addVideoStream(key, stream);
    }
  }

  private static getSupportedRecorderType(): { mime: string; ext: string } {
    const candidates: { mime: string; ext: string }[] = [
      { mime: "video/webm;codecs=vp9", ext: "webm" },
      { mime: "video/webm;codecs=vp8", ext: "webm" },
      { mime: "video/webm", ext: "webm" },
      { mime: "video/mp4;codecs=h264", ext: "mp4" },
      { mime: "video/mp4", ext: "mp4" },
    ];
    for (const c of candidates) {
      if (
        (window as any).MediaRecorder &&
        MediaRecorder.isTypeSupported &&
        MediaRecorder.isTypeSupported(c.mime)
      ) {
        return c;
      }
    }
    return { mime: "video/webm", ext: "webm" };
  }

  get isRecording(): boolean {
    return this._isRecording;
  }

  get currentEpisode(): LeRobotEpisode | undefined {
    return this.teleoperatorData.at(-1);
  }

  /**
   * Adds a new video stream to be recorded
   * @param key The key to identify this video stream
   * @param stream The media stream to record from
   */
  addVideoStream(key: string, stream: MediaStream) {
    if (this._isRecording) {
      throw new Error("Cannot add video streams while recording");
    }

    // Add to video streams dictionary
    this.videoStreams[key] = stream;
    // Initialize chunks storage
    this.videoChunks[key] = [];

    // Pre-warm container selection for consistent extension even if added before start
    const { mime, ext } = LeRobotDatasetRecorder.getSupportedRecorderType();
    this.videoMimeByKey[key] = { mime, ext };
  }

  /**
   * Add a new teleoperator and set up state update callbacks
   * for recording joint position data in the LeRobot dataset format
   *
   * @param teleoperator The teleoperator to add callbacks to
   */
  addTeleoperator(teleoperator: WebTeleoperator) {
    teleoperator.addOnStateUpdateCallback((params) => {
      if (this._isRecording) {
        if (!this.currentEpisode)
          throw Error(
            "There is no current episode while recording, something is wrong!, this means that no frames exist on the recorder for some reason"
          );

        // Create a frame with the current state data
        // Using the normalized configs for consistent data ranges
        const frame: NonIndexedLeRobotDatasetRow = {
          timestamp: params.commandSentTimestamp,
          // For observation state, use the current motor positions
          "observation.state": this.convertMotorConfigToArray(
            params.newMotorConfigsNormalized
          ),
          // For action, use the target positions that were commanded
          action: this.convertMotorConfigToArray(
            params.previousMotorConfigsNormalized
          ),
          episode_index: this.episodeIndex,
          task_index: this.taskIndex,
        };

        // Add the frame to the current episode
        this.currentEpisode.add(frame);
      }
    });

    this.teleoperators.push(teleoperator);
  }

  /**
   * Starts recording for all teleoperators and video streams
   */
  startRecording() {
    if (this._isRecording) {
      console.warn("Recording already in progress");
      return;
    }

    this._isRecording = true;

    // add a new episode and mark current video segment episode index
    this.teleoperatorData.push(new LeRobotEpisode());
    this.currentVideoSegmentEpisodeIndex = this.episodeIndex;

    // Start recording video streams
    Object.entries(this.videoStreams).forEach(([key, stream]) => {
      // Pick a supported mime/container pair per browser
      const { mime, ext } = LeRobotDatasetRecorder.getSupportedRecorderType();
      this.videoMimeByKey[key] = { mime, ext };
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });

      // Handle data available events
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.videoChunks[key].push(event.data);
        }
      };

      // Save the recorder and start recording
      this.mediaRecorders[key] = mediaRecorder;
      mediaRecorder.start(1000); // Capture in 1-second chunks
    });
  }

  setEpisodeIndex(index: number): void {
    this.episodeIndex = index;
  }

  setTaskIndex(index: number): void {
    this.taskIndex = index;
  }

  /**
   * teleoperatorData by default only contains data
   * for the episodes in a non-regularized manner
   *
   * this function returns episodes in a regularized manner, wherein
   * the frames in each are interpolated through so that all frames are spaced
   * equally through each other
   */
  get episodes(): LeRobotEpisode[] {
    const regularizedEpisodes: LeRobotEpisode[] = [];
    let lastFrameIndex = 0;

    for (let i = 0; i < this.teleoperatorData.length; i++) {
      let episode = this.teleoperatorData[i];
      const regularizedEpisode = episode.getInterpolatedRegularEpisode(
        this.fps,
        lastFrameIndex
      );
      regularizedEpisodes.push(regularizedEpisode);

      lastFrameIndex += regularizedEpisode.frames?.at(-1)?.index || 0;
    }

    return regularizedEpisodes;
  }

  /**
   * Stops recording for all teleoperators and video streams
   * @returns An object containing teleoperator data and video blobs
   */
  async stopRecording() {
    if (!this._isRecording) {
      console.warn("No recording in progress");
      return { teleoperatorData: [], videoBlobs: {} };
    }

    this._isRecording = false;

    // Stop all media recorders
    const stopPromises = Object.entries(this.mediaRecorders).map(
      ([key, recorder]) => {
        return new Promise<void>((resolve) => {
          // Only do this if the recorder is active
          if (recorder.state === "inactive") {
            resolve();
            return;
          }

          // When the recorder stops, create a blob
          recorder.onstop = () => {
            // Combine all chunks into a single blob
            const chunks = this.videoChunks[key] || [];
            const mime = this.videoMimeByKey[key]?.mime || "video/webm";
            const blob = new Blob(chunks, { type: mime });
            this.videoBlobs[key] = blob;
            const segmentEpisodeIndex =
              this.currentVideoSegmentEpisodeIndex ?? this.episodeIndex;
            if (!this.videoBlobsByEpisode[segmentEpisodeIndex]) {
              this.videoBlobsByEpisode[segmentEpisodeIndex] = {} as any;
            }
            this.videoBlobsByEpisode[segmentEpisodeIndex][key] = blob;
            resolve();
          };

          // Stop the recorder
          recorder.stop();
        });
      }
    );

    // Wait for all recorders to stop
    await Promise.all(stopPromises);
    return {
      teleoperatorData: this.episodes,
      videoBlobs: this.videoBlobs,
    };
  }

  /**
   * Clears the teleoperator data and video blobs
   */
  clearRecording() {
    this.teleoperatorData = [];
    this.videoBlobs = {};
  }

  /**
   * Action is a dictionary of motor positions, timestamp1 and timestamp2 are when the actions occurred
   * reqTimestamp must be between timestamp1 and timestamp2
   *
   * the keys in action1 and action2 must match, this will loop through the dictionary
   * and interpolate each action to the required timestamp
   *
   * @param action1 Motor positions at timestamp1
   * @param action2 Motor positions at timestamp2
   * @param timestamp1 The timestamp of action1
   * @param timestamp2 The timestamp of action2
   * @param reqTimestamp The timestamp at which to interpolate
   * @returns The interpolated action
   */
  _actionInterpolatate(
    action1: any,
    action2: any,
    timestamp1: number,
    timestamp2: number,
    reqTimestamp: number
  ): any {
    if (reqTimestamp < timestamp1 || reqTimestamp > timestamp2)
      throw new Error("reqTimestamp must be between timestamp1 and timestamp2");
    if (timestamp2 < timestamp1)
      throw new Error("timestamp2 must be greater than timestamp1");

    const numActions = Object.keys(action1).length;
    const interpolatedAction: any = {};
    const timeRange = timestamp2 - timestamp1;

    for (let i = 0; i < numActions; i++) {
      const key = Object.keys(action1)[i];
      interpolatedAction[key] =
        action1[key] +
        ((action2[key] - action1[key]) * (reqTimestamp - timestamp1)) /
          timeRange;
    }

    return interpolatedAction;
  }

  /**
   * Converts an action object to an array of numbers
   * follows the same pattern as https://huggingface.co/datasets/lerobot/svla_so100_pickplace
   * I am not really sure if the array can be in a different order
   * but I am not going to risk it tbh 😛
   *
   * @param action The action object to convert
   * @returns An array of numbers
   */
  convertActionToArray(action: any): number[] {
    return [
      action["shoulder_pan"],
      action["shoulder_lift"],
      action["elbow_flex"],
      action["wrist_flex"],
      action["wrist_roll"],
      action["gripper"],
    ];
  }

  /**
   * Converts an array of MotorConfig objects to an action object
   * following the same joint order as convertActionToArray
   *
   * @param motorConfigs Array of MotorConfig objects
   * @returns An action object with joint positions
   */
  convertMotorConfigToArray(motorConfigs: MotorConfig[]): number[] {
    // Create a map for quick lookup of motor positions by name
    const motorMap: Record<string, number> = {};
    for (const config of motorConfigs) {
      motorMap[config.name] = config.currentPosition;
    }

    // Define required joint names
    const requiredJoints = [
      "shoulder_pan",
      "shoulder_lift",
      "elbow_flex",
      "wrist_flex",
      "wrist_roll",
      "gripper",
    ];

    // Check that all required joints are present
    const missingJoints = requiredJoints.filter(
      (joint) => motorMap[joint] === undefined
    );
    if (missingJoints.length > 0) {
      throw new Error(
        `Missing required joints in motor configs: ${missingJoints.join(
          ", "
        )}. Available joints: ${Object.keys(motorMap).join(", ")}`
      );
    }

    // Return in the same order as convertActionToArray
    return [
      motorMap["shoulder_pan"],
      motorMap["shoulder_lift"],
      motorMap["elbow_flex"],
      motorMap["wrist_flex"],
      motorMap["wrist_roll"],
      motorMap["gripper"],
    ];
  }

  /**
   * Finds the closest timestamp to the target timestamp
   *
   * the data must have timestamps in ascending order
   * uses binary search to get the closest timestamp
   *
   * @param data The data to search through
   * @param targetTimestamp The target timestamp
   * @returns The closest timestamp in the data's index
   */
  _findClosestTimestampBefore(data: any[], targetTimestamp: number): number {
    let firstIndex = 0;
    let lastIndex = data.length - 1;

    while (firstIndex <= lastIndex) {
      const middleIndex = Math.floor((firstIndex + lastIndex) / 2);
      const middleTimestamp = data[middleIndex].timestamp;

      if (middleTimestamp === targetTimestamp) {
        return middleIndex;
      } else if (middleTimestamp < targetTimestamp) {
        firstIndex = middleIndex + 1;
      } else {
        lastIndex = middleIndex - 1;
      }
    }

    return lastIndex;
  }

  /**
   * Takes non-regularly spaced lerobot-ish data and interpolates it to a regularly spaced dataset
   * also adds additional
   * - frame_index
   * - episode_index
   * - index columns
   *
   * to match lerobot dataset requirements
   */
  _interpolateAndCompleteLerobotData(
    fps: number,
    frameData: NonIndexedLeRobotDatasetRow[],
    lastFrameIndex: number
  ): LeRobotDatasetRow[] {
    const interpolatedData: LeRobotDatasetRow[] = [];
    const minTimestamp = frameData[0].timestamp;
    const maxTimestamp = frameData[frameData.length - 1].timestamp;
    const timeDifference = maxTimestamp - minTimestamp;
    const numFrames = Math.floor(timeDifference * fps);
    const firstFrame = frameData[0];

    console.log(
      "frames before interpolation",
      numFrames,
      frameData[0].timestamp,
      frameData[frameData.length - 1].timestamp,
      fps
    );

    interpolatedData.push({
      timestamp: firstFrame.timestamp,
      action: this.convertActionToArray(firstFrame.action),
      "observation.state": this.convertActionToArray(
        firstFrame["observation.state"]
      ),
      episode_index: firstFrame.episode_index,
      task_index: firstFrame.task_index,
      frame_index: 0,
      index: lastFrameIndex,
    });

    // start from 1 as the first frame is pushed already (see above)
    for (let i = 1; i < numFrames; i++) {
      const timestamp = i / fps;
      const closestIndex = this._findClosestTimestampBefore(
        frameData,
        timestamp
      );
      const nextIndex = closestIndex + 1;
      const closestItemData = frameData[closestIndex];
      const nextItemData = frameData[nextIndex];
      const action = this._actionInterpolatate(
        closestItemData.action,
        nextItemData.action,
        closestItemData.timestamp,
        nextItemData.timestamp,
        timestamp
      );
      const observation_state = this._actionInterpolatate(
        closestItemData["observation.state"],
        nextItemData["observation.state"],
        closestItemData.timestamp,
        nextItemData.timestamp,
        timestamp
      );

      interpolatedData.push({
        timestamp: timestamp,
        action: this.convertActionToArray(action),
        "observation.state": this.convertActionToArray(observation_state),
        episode_index: closestItemData.episode_index,
        task_index: closestItemData.task_index,
        frame_index: i,
        index: lastFrameIndex + i,
      });
    }

    return interpolatedData;
  }

  /**
   * converts all the frames of a recording into lerobot dataset frame style
   *
   * NOTE : This does not interpolate the data, you are only working with raw data
   * that is called by the teleop when things are actively "changing"
   * @param episodeRough
   */
  _convertToLeRobotDataFormatFrames(
    episodeRough: any[]
  ): NonIndexedLeRobotDatasetRow[] {
    const properFormatFrames: NonIndexedLeRobotDatasetRow[] = [];

    const firstTimestamp = episodeRough[0].commandSentTimestamp;
    for (let i = 0; i < episodeRough.length; i++) {
      const frameRough = episodeRough[i];

      properFormatFrames.push({
        timestamp: frameRough.commandSentTimestamp - firstTimestamp, // so timestamps start from 0, and are in seconds
        action: frameRough.previousMotorConfigsNormalized,
        "observation.state": frameRough.newMotorConfigsNormalized,
        episode_index: frameRough.episodeIndex,
        task_index: frameRough.taskIndex,
      });
    }

    return properFormatFrames;
  }

  /**
   * Converts teleoperator data to a parquet blob
   * @private
   * @returns Array of objects containing parquet file content and path
   */
  private async _exportEpisodesToBlob(
    episodes: LeRobotEpisode[]
  ): Promise<{ content: Blob; path: string }[]> {
    // combine all the frames
    let data: NonIndexedLeRobotDatasetRow[] = [];
    const episodeBlobs: any[] = [];

    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      data = episode.frames;
      const { tableFromArrays, vectorFromArray } = arrow;

      const timestamps = data.map((row: any) => row.timestamp);
      const actions = data.map((row: any) => row.action);
      const observationStates = data.map(
        (row: any) => row["observation.state"]
      );
      const episodeIndexes = data.map((row: any) => row.episode_index);
      const taskIndexes = data.map((row: any) => row.task_index);
      const frameIndexes = data.map((row: any) => row.frame_index);
      const indexes = data.map((row: any) => row.index);

      const table = tableFromArrays({
        timestamp: timestamps,
        // @ts-ignore, this works, idk why
        action: vectorFromArray(
          actions,
          new arrow.List(new arrow.Field("item", new arrow.Float32()))
        ),
        // @ts-ignore, this works, idk why
        "observation.state": vectorFromArray(
          observationStates,
          new arrow.List(new arrow.Field("item", new arrow.Float32()))
        ),
        episode_index: episodeIndexes,
        task_index: taskIndexes,
        frame_index: frameIndexes,
        index: indexes,
      });

      const wasmUrl =
        "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/esm/parquet_wasm_bg.wasm";
      const initWasm = parquet.default;
      await initWasm(wasmUrl);

      const wasmTable = parquet.Table.fromIPCStream(
        arrow.tableToIPC(table, "stream")
      );
      const writerProperties = new parquet.WriterPropertiesBuilder()
        .setCompression(parquet.Compression.UNCOMPRESSED)
        .build();

      const parquetUint8Array = parquet.writeParquet(
        wasmTable,
        writerProperties
      );
      const numpadded = i.toString().padStart(6, "0");
      const content = new Blob([
        LeRobotDatasetRecorder.toArrayBuffer(parquetUint8Array as Uint8Array),
      ]);

      episodeBlobs.push({
        content,
        path: `data/chunk-000/episode_${numpadded}.parquet`,
      });
    }

    return episodeBlobs;
  }

  /**
   * Exports the teleoperator data in lerobot format
   * @param format The format to return the data in ('json' or 'blob')
   * @returns Either an array of data objects or a Uint8Array blob depending on format
   */
  exportEpisodes(format: "json" | "blob" = "json") {
    if (this._isRecording)
      throw new Error("This can only be called after recording has stopped!");
    const data = this.episodes;

    if (format === "json") {
      return data;
    } else {
      return this._exportEpisodesToBlob(data);
    }
  }

  /**
   * Exports the media (video) data as blobs
   * @returns A dictionary of video blobs with the same keys as videoStreams
   */
  async exportMediaData(): Promise<{ [key: string]: Blob }> {
    if (this._isRecording)
      throw new Error("This can only be called after recording has stopped!");
    return this.videoBlobs;
  }

  /**
   * Generates metadata for the dataset
   * @returns Metadata object for the LeRobot dataset
   */
  async generateMetadata(data: any[]): Promise<any> {
    // Calculate total episodes, frames, and tasks
    let total_episodes = 0;
    const total_frames = data.length;
    let total_tasks = 0;

    for (const row of data) {
      total_episodes = Math.max(total_episodes, row.episode_index);
      total_tasks = Math.max(total_tasks, row.task_index);
    }

    // Create video info objects for each video stream
    const cameraKeySet = new Set<string>();
    Object.keys(this.videoBlobs).forEach((k) => cameraKeySet.add(k));
    Object.values(this.videoBlobsByEpisode || {}).forEach((byCam) =>
      Object.keys(byCam || {}).forEach((k) => cameraKeySet.add(k))
    );
    const videos_info: VideoInfo[] = Array.from(cameraKeySet).map((key) => {
      // Default values - in a production environment, you would extract
      // these from the actual video metadata using the key to identify the video source
      console.log(`Generating metadata for video stream: ${key}`);
      return {
        height: 480,
        width: 640,
        channels: 3,
        codec: "h264",
        pix_fmt: "yuv420p",
        is_depth_map: false,
        has_audio: false,
      };
    });

    // Calculate approximate file sizes in MB
    const data_files_size_in_mb = Math.round(data.length * 0.001); // Estimate

    // Calculate video size by summing the sizes of all video blobs and converting to MB
    let video_files_size_in_mb = 0;
    for (const blob of Object.values(this.videoBlobs)) {
      video_files_size_in_mb += blob.size / (1024 * 1024);
    }
    for (const byCam of Object.values(this.videoBlobsByEpisode || {})) {
      for (const blob of Object.values(byCam || {})) {
        video_files_size_in_mb += (blob as Blob).size / (1024 * 1024);
      }
    }
    video_files_size_in_mb = Math.round(video_files_size_in_mb);

    // Generate and return the metadata
    return getMetadataInfo({
      total_episodes,
      total_frames,
      total_tasks,
      chunks_size: 1000, // Default chunk size
      fps: this.fps,
      splits: { train: `0:${total_episodes}` }, // All episodes in train split
      features: {}, // Additional features can be added here
      videos_info,
      data_files_size_in_mb,
      video_files_size_in_mb,
    });
  }

  /**
   * Generates statistics for the dataset
   * @returns Statistics object for the LeRobot dataset
   */
  async getStatistics(data: any[]): Promise<any> {
    // Get camera keys from any available blobs
    const cameraKeySet2 = new Set<string>();
    Object.keys(this.videoBlobs).forEach((k) => cameraKeySet2.add(k));
    Object.values(this.videoBlobsByEpisode || {}).forEach((byCam) =>
      Object.keys(byCam || {}).forEach((k) => cameraKeySet2.add(k))
    );
    const cameraKeys = Array.from(cameraKeySet2);

    // Generate stats using the data and camera keys
    return getStats(data, cameraKeys);
  }

  /**
   * Creates a tasks.parquet file containing task description
   * @returns A Uint8Array blob containing the parquet data
   */
  async createTasksParquet(): Promise<Uint8Array> {
    // Create a simple data structure with the task description
    const tasksData = [
      {
        task_index: 0,
        __index_level_0__: this.taskDescription,
      },
    ];

    // Create Arrow table from the data
    const taskIndexArr = arrow.vectorFromArray(
      tasksData.map((d) => d.task_index),
      new arrow.Int32()
    );
    const descriptionArr = arrow.vectorFromArray(
      tasksData.map((d) => d.__index_level_0__),
      new arrow.Utf8()
    );

    const table = arrow.tableFromArrays({
      // @ts-ignore, this works, idk why
      task_index: taskIndexArr,
      // @ts-ignore, this works, idk why
      __index_level_0__: descriptionArr,
    });

    // Initialize the WASM module
    const wasmUrl =
      "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/esm/parquet_wasm_bg.wasm";
    const initWasm = parquet.default;
    await initWasm(wasmUrl);

    // Convert Arrow table to Parquet WASM table
    const wasmTable = parquet.Table.fromIPCStream(
      arrow.tableToIPC(table, "stream")
    );

    // Set compression properties
    const writerProperties = new parquet.WriterPropertiesBuilder()
      .setCompression(parquet.Compression.UNCOMPRESSED)
      .build();

    // Write the Parquet file
    return parquet.writeParquet(wasmTable, writerProperties);
  }

  /**
   * Creates the episodes statistics parquet file
   * @returns A Uint8Array blob containing the parquet data
   */
  async getEpisodeStatistics(data: any[]): Promise<Uint8Array> {
    const { vectorFromArray } = arrow;
    const statistics = await this.getStatistics(data);

    // Calculate total episodes and frames
    let total_episodes = 0;

    for (let row of data) {
      total_episodes = Math.max(total_episodes, row.episode_index);
    }

    total_episodes += 1; // +1 since episodes start from 0

    const episodes: any[] = [];

    // we'll create one row per episode
    for (
      let episode_index = 0;
      episode_index < total_episodes;
      episode_index++
    ) {
      // Get data for this episode only
      const episodeData = data.filter(
        (row) => row.episode_index === episode_index
      );

      // Extract timestamps for this episode
      const timestamps = episodeData.map((row) => row.timestamp);
      let min_timestamp = Infinity;
      let max_timestamp = -Infinity;

      for (let timestamp of timestamps) {
        min_timestamp = Math.min(min_timestamp, timestamp);
        max_timestamp = Math.max(max_timestamp, timestamp);
      }

      // Camera keys from video blobs
      const cameraKeys = Object.keys(this.videoBlobs);

      // Create entry for this episode
      const episodeEntry: any = {
        // Basic episode information
        episode_index: episode_index,
        "data/chunk_index": 0,
        "data/file_index": 0,
        dataset_from_index: 0,
        dataset_to_index: episodeData.length - 1,
        length: episodeData.length,
        tasks: [0], // Task index 0, could be extended for multiple tasks

        // Meta information
        "meta/episodes/chunk_index": 0,
        "meta/episodes/file_index": 0,
      };

      // Add video information for each camera
      cameraKeys.forEach((key) => {
        episodeEntry[`videos/observation.images.${key}/chunk_index`] = 0;
        episodeEntry[`videos/observation.images.${key}/file_index`] = 0;
        episodeEntry[`videos/observation.images.${key}/from_timestamp`] =
          min_timestamp;
        episodeEntry[`videos/observation.images.${key}/to_timestamp`] =
          max_timestamp;
      });

      // Add statistics for each field
      // This is a simplified approach - in a real implementation, you'd calculate
      // these values for each episode individually

      // Add timestamp statistics
      episodeEntry["stats/timestamp/min"] = [statistics.timestamp.min];
      episodeEntry["stats/timestamp/max"] = [statistics.timestamp.max];
      episodeEntry["stats/timestamp/mean"] = [statistics.timestamp.mean];
      episodeEntry["stats/timestamp/std"] = [statistics.timestamp.std];
      episodeEntry["stats/timestamp/count"] = [statistics.timestamp.count];

      // Add frame_index statistics
      episodeEntry["stats/frame_index/min"] = [statistics.frame_index.min];
      episodeEntry["stats/frame_index/max"] = [statistics.frame_index.max];
      episodeEntry["stats/frame_index/mean"] = [statistics.frame_index.mean];
      episodeEntry["stats/frame_index/std"] = [statistics.frame_index.std];
      episodeEntry["stats/frame_index/count"] = [statistics.frame_index.count];

      // Add episode_index statistics
      episodeEntry["stats/episode_index/min"] = [statistics.episode_index.min];
      episodeEntry["stats/episode_index/max"] = [statistics.episode_index.max];
      episodeEntry["stats/episode_index/mean"] = [
        statistics.episode_index.mean,
      ];
      episodeEntry["stats/episode_index/std"] = [statistics.episode_index.std];
      episodeEntry["stats/episode_index/count"] = [
        statistics.episode_index.count,
      ];

      // Add task_index statistics
      episodeEntry["stats/task_index/min"] = [statistics.task_index.min];
      episodeEntry["stats/task_index/max"] = [statistics.task_index.max];
      episodeEntry["stats/task_index/mean"] = [statistics.task_index.mean];
      episodeEntry["stats/task_index/std"] = [statistics.task_index.std];
      episodeEntry["stats/task_index/count"] = [statistics.task_index.count];

      // Add index statistics
      episodeEntry["stats/index/min"] = [0];
      episodeEntry["stats/index/max"] = [episodeData.length - 1];
      episodeEntry["stats/index/mean"] = [episodeData.length / 2];
      episodeEntry["stats/index/std"] = [episodeData.length / 4]; // Approximate std
      episodeEntry["stats/index/count"] = [episodeData.length];

      // Add action statistics (placeholder)
      episodeEntry["stats/action/min"] = [0.0];
      episodeEntry["stats/action/max"] = [1.0];
      episodeEntry["stats/action/mean"] = [0.5];
      episodeEntry["stats/action/std"] = [0.2];
      episodeEntry["stats/action/count"] = [episodeData.length];

      // Add observation.state statistics (placeholder)
      episodeEntry["stats/observation.state/min"] = [0.0];
      episodeEntry["stats/observation.state/max"] = [1.0];
      episodeEntry["stats/observation.state/mean"] = [0.5];
      episodeEntry["stats/observation.state/std"] = [0.2];
      episodeEntry["stats/observation.state/count"] = [episodeData.length];

      // Add observation.images statistics for each camera
      cameraKeys.forEach((key) => {
        // Get the image statistics from the overall statistics
        const imageStats = statistics[`observation.images.${key}`] || {
          min: [[[0.0]], [[0.0]], [[0.0]]],
          max: [[[255.0]], [[255.0]], [[255.0]]],
          mean: [[[127.5]], [[127.5]], [[127.5]]],
          std: [[[50.0]], [[50.0]], [[50.0]]],
          count: [[[episodeData.length * 3]]],
        };

        episodeEntry[`stats/observation.images.${key}/min`] = imageStats.min;
        episodeEntry[`stats/observation.images.${key}/max`] = imageStats.max;
        episodeEntry[`stats/observation.images.${key}/mean`] = imageStats.mean;
        episodeEntry[`stats/observation.images.${key}/std`] = imageStats.std;
        episodeEntry[`stats/observation.images.${key}/count`] =
          imageStats.count;
      });

      episodes.push(episodeEntry);
    }

    // Create vector arrays for each column
    const columns: any = {};

    // Define column names and default types
    const columnNames = [
      "episode_index",
      "data/chunk_index",
      "data/file_index",
      "dataset_from_index",
      "dataset_to_index",
      "length",
      "meta/episodes/chunk_index",
      "meta/episodes/file_index",
      "tasks",
    ];

    // Add camera-specific columns
    const cameraKeys = Object.keys(this.videoBlobs);
    cameraKeys.forEach((key) => {
      columnNames.push(
        `videos/observation.images.${key}/chunk_index`,
        `videos/observation.images.${key}/file_index`,
        `videos/observation.images.${key}/from_timestamp`,
        `videos/observation.images.${key}/to_timestamp`
      );
    });

    // Add statistic columns for each field
    const statFields = [
      "timestamp",
      "frame_index",
      "episode_index",
      "task_index",
      "index",
      "action",
      "observation.state",
    ];
    statFields.forEach((field) => {
      columnNames.push(
        `stats/${field}/min`,
        `stats/${field}/max`,
        `stats/${field}/mean`,
        `stats/${field}/std`,
        `stats/${field}/count`
      );
    });

    // Add image statistic columns for each camera
    cameraKeys.forEach((key) => {
      columnNames.push(
        `stats/observation.images.${key}/min`,
        `stats/observation.images.${key}/max`,
        `stats/observation.images.${key}/mean`,
        `stats/observation.images.${key}/std`,
        `stats/observation.images.${key}/count`
      );
    });

    // Create vector arrays for each column
    columnNames.forEach((columnName) => {
      const values = episodes.map((ep) => ep[columnName] || 0);

      // Check if the column is an array type and needs special handling
      if (columnName.includes("stats/") || columnName === "tasks") {
        // Handle different types of array columns based on their naming pattern
        if (columnName.includes("/count")) {
          // Bigint arrays for count fields
          // @ts-ignore
          columns[columnName] = vectorFromArray(
            values.map((v) => Number(v)),
            new arrow.List(new arrow.Field("item", new arrow.Int64()))
          );
        } else if (
          columnName.includes("/min") ||
          columnName.includes("/max") ||
          columnName.includes("/mean") ||
          columnName.includes("/std")
        ) {
          // Double arrays for min, max, mean, std fields
          if (
            columnName.includes("observation.images") &&
            (columnName.includes("/min") ||
              columnName.includes("/max") ||
              columnName.includes("/mean") ||
              columnName.includes("/std"))
          ) {
            // These are 3D arrays [[[value]]]
            // For 3D arrays, we need nested Lists
            // @ts-ignore
            columns[columnName] = vectorFromArray(
              values,
              new arrow.List(
                new arrow.Field(
                  "item",
                  new arrow.List(
                    new arrow.Field(
                      "subitem",
                      new arrow.List(
                        new arrow.Field("value", new arrow.Float64())
                      )
                    )
                  )
                )
              )
            );
          } else {
            // These are normal arrays [value]
            // @ts-ignore
            columns[columnName] = vectorFromArray(
              values,
              new arrow.List(new arrow.Field("item", new arrow.Float64()))
            );
          }
        } else {
          // Default to Float64 List for other array types
          // @ts-ignore
          columns[columnName] = vectorFromArray(
            values,
            new arrow.List(new arrow.Field("item", new arrow.Float64()))
          );
        }
      } else {
        // For non-array columns, use regular vectorFromArray
        // @ts-ignore
        columns[columnName] = vectorFromArray(values);
      }
    });

    // Create the table with all columns
    const table = arrow.tableFromArrays(columns);

    // Initialize the WASM module
    const wasmUrl =
      "https://cdn.jsdelivr.net/npm/parquet-wasm@0.6.1/esm/parquet_wasm_bg.wasm";
    const initWasm = parquet.default;
    await initWasm(wasmUrl);

    // Convert Arrow table to Parquet WASM table
    const wasmTable = parquet.Table.fromIPCStream(
      arrow.tableToIPC(table, "stream")
    );

    // Set compression properties
    const writerProperties = new parquet.WriterPropertiesBuilder()
      .setCompression(parquet.Compression.UNCOMPRESSED)
      .build();

    // Write the Parquet file
    return parquet.writeParquet(wasmTable, writerProperties);
  }

  generateREADME(metaInfo: string) {
    return generateREADME(metaInfo);
  }

  /**
   * Creates an array of path and blob content objects for the LeRobot dataset
   *
   * @returns An array of {path, content} objects representing the dataset files
   * @private
   */
  async _exportForLeRobotBlobs() {
    const teleoperatorDataJson = (await this.exportEpisodes("json")) as any[];
    const parquetEpisodeDataFiles = await this._exportEpisodesToBlob(
      teleoperatorDataJson
    );
    const videoBlobs = await this.exportMediaData();
    const metadata = await this.generateMetadata(teleoperatorDataJson);
    const statistics = await this.getStatistics(teleoperatorDataJson);
    const tasksParquet = await this.createTasksParquet();
    const episodesParquet = await this.getEpisodeStatistics(
      teleoperatorDataJson
    );
    const readme = this.generateREADME(JSON.stringify(metadata));

    // Create the blob array with proper paths
    const blobArray = [
      ...parquetEpisodeDataFiles,
      {
        path: "meta/info.json",
        content: new Blob([JSON.stringify(metadata, null, 2)], {
          type: "application/json",
        }),
      },
      {
        path: "meta/stats.json",
        content: new Blob([JSON.stringify(statistics, null, 2)], {
          type: "application/json",
        }),
      },
      {
        path: "meta/tasks.parquet",
        content: new Blob([
          LeRobotDatasetRecorder.toArrayBuffer(tasksParquet as Uint8Array),
        ]),
      },
      {
        path: "meta/episodes/chunk-000/file-000.parquet",
        content: new Blob([
          LeRobotDatasetRecorder.toArrayBuffer(episodesParquet as Uint8Array),
        ]),
      },
      {
        path: "README.md",
        content: new Blob([readme], { type: "text/markdown" }),
      },
    ];

    // Add video blobs with proper paths (use container extension based on recorded mime)
    if (
      this.videoBlobsByEpisode &&
      Object.keys(this.videoBlobsByEpisode).length > 0
    ) {
      const episodeIndices = Object.keys(this.videoBlobsByEpisode)
        .map((s) => parseInt(s))
        .sort((a, b) => a - b);
      for (const epIdx of episodeIndices) {
        const byCam = this.videoBlobsByEpisode[epIdx] || {};
        for (const [key, blob] of Object.entries(byCam)) {
          const ext = this.videoMimeByKey[key]?.ext || "webm";
          const numpadded = epIdx.toString().padStart(6, "0");
          blobArray.push({
            path: `videos/chunk-000/observation.images.${key}/episode_${numpadded}.${ext}`,
            content: blob,
          });
        }
      }
    } else {
      for (const [key, blob] of Object.entries(videoBlobs)) {
        const ext = this.videoMimeByKey[key]?.ext || "webm";
        blobArray.push({
          path: `videos/chunk-000/observation.images.${key}/episode_000000.${ext}`,
          content: blob,
        });
      }
    }

    return blobArray;
  }

  /**
   * Creates a ZIP file from the dataset blobs
   *
   * @returns A Blob containing the ZIP file
   * @private
   */
  async _exportForLeRobotZip() {
    const blobArray = await this._exportForLeRobotBlobs();
    const zip = new JSZip();

    // Add all blobs to the zip with their paths
    for (const item of blobArray) {
      // Split the path to handle directories
      const pathParts = item.path.split("/");
      const fileName = pathParts.pop() || "";
      let currentFolder = zip;

      // Create nested folders as needed
      if (pathParts.length > 0) {
        for (const part of pathParts) {
          currentFolder = currentFolder.folder(part) || currentFolder;
        }
      }

      // Add file to the current folder
      currentFolder.file(fileName, item.content);
    }

    // Generate the zip file
    return await zip.generateAsync({ type: "blob" });
  }

  /**
   * Uploads the LeRobot dataset to Hugging Face
   *
   * @param username Hugging Face username
   * @param repoName Repository name for the dataset
   * @param accessToken Hugging Face access token
   * @returns The LeRobotHFUploader instance used for upload
   */
  async _exportForLeRobotHuggingface(
    username: string,
    repoName: string,
    accessToken: string,
    privateRepo: boolean = false
  ) {
    // Create the blobs array for upload
    const blobArray = await this._exportForLeRobotBlobs();

    // Create the uploader
    const uploader = new LeRobotHFUploader(username, repoName);

    // Convert blobs to File objects for HF uploader
    const files = blobArray.map((item) => {
      return {
        path: item.path,
        content: item.content,
      };
    });

    // Generate a unique reference ID for tracking the upload
    const referenceId = `lerobot-upload-${Date.now()}`;

    try {
      // Start the upload process
      uploader.createRepoAndUploadFiles(
        files,
        accessToken,
        referenceId,
        privateRepo
      );
      console.log(`Successfully uploaded dataset to ${username}/${repoName}`);
      return uploader;
    } catch (error) {
      console.error("Error uploading to Hugging Face:", error);
      throw error;
    }
  }

  /**
   * Uploads the LeRobot dataset to Amazon S3
   *
   * @param bucketName S3 bucket name
   * @param accessKeyId AWS access key ID
   * @param secretAccessKey AWS secret access key
   * @param region AWS region (default: us-east-1)
   * @param prefix Optional prefix (folder) to upload files to within the bucket
   * @returns The LeRobotS3Uploader instance used for upload
   */
  async _exportForLeRobotS3(
    bucketName: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string = "us-east-1",
    prefix: string = ""
  ) {
    // Create the blobs array for upload
    const blobArray = await this._exportForLeRobotBlobs();

    // Create the uploader
    const uploader = new LeRobotS3Uploader(bucketName, region);

    // Convert blobs to File objects for S3 uploader
    const files = blobArray.map((item) => {
      return {
        path: item.path,
        content: item.content,
      };
    });

    // Generate a unique reference ID for tracking the upload
    const referenceId = `lerobot-s3-upload-${Date.now()}`;

    try {
      // Start the upload process
      uploader.checkBucketAndUploadFiles(
        files,
        accessKeyId,
        secretAccessKey,
        prefix,
        referenceId
      );
      console.log(`Successfully uploaded dataset to S3 bucket: ${bucketName}`);
      return uploader;
    } catch (error) {
      console.error("Error uploading to S3:", error);
      throw error;
    }
  }

  /**
   * Exports the LeRobot dataset in various formats
   *
   * @param format The export format - 'blobs', 'zip', 'zip-download', 'huggingface', or 's3'
   * @param options Additional options for specific formats
   * @param options.username Hugging Face username (if not provided for "huggingface" format, it will use the default username)
   * @param options.repoName Hugging Face repository name (required for 'huggingface' format)
   * @param options.accessToken Hugging Face access token (required for 'huggingface' format)
   * @param options.bucketName S3 bucket name (required for 's3' format)
   * @param options.accessKeyId AWS access key ID (required for 's3' format)
   * @param options.secretAccessKey AWS secret access key (required for 's3' format)
   * @param options.region AWS region (optional for 's3' format, default: us-east-1)
   * @param options.prefix S3 prefix/folder (optional for 's3' format)
   * @returns The exported data in the requested format or the uploader instance for 'huggingface'/'s3' formats
   */
  async exportForLeRobot(
    format:
      | "blobs"
      | "zip"
      | "zip-download"
      | "huggingface"
      | "s3" = "zip-download",
    options?: {
      username?: string;
      repoName?: string;
      accessToken?: string;
      bucketName?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      region?: string;
      prefix?: string;
    }
  ) {
    switch (format) {
      case "blobs":
        return this._exportForLeRobotBlobs();

      case "zip":
        return this._exportForLeRobotZip();

      case "huggingface":
        // Validate required options for Hugging Face upload
        if (!options || !options.repoName || !options.accessToken) {
          throw new Error(
            "Hugging Face upload requires repoName, and accessToken options"
          );
        }

        if (!options.username) {
          const hub = await import("@huggingface/hub");
          const { name: username } = await hub.whoAmI({
            accessToken: options.accessToken,
          });
          options.username = username;
        }

        return this._exportForLeRobotHuggingface(
          options.username,
          options.repoName,
          options.accessToken,
          (options as any).privateRepo ?? false
        );

      case "s3":
        // Validate required options for S3 upload
        if (
          !options ||
          !options.bucketName ||
          !options.accessKeyId ||
          !options.secretAccessKey
        ) {
          throw new Error(
            "S3 upload requires bucketName, accessKeyId, and secretAccessKey options"
          );
        }

        return this._exportForLeRobotS3(
          options.bucketName,
          options.accessKeyId,
          options.secretAccessKey,
          options.region,
          options.prefix
        );

      case "zip-download":
      default:
        // Get the zip blob
        const zipContent = await this._exportForLeRobotZip();

        // Create a URL for the zip file
        const url = URL.createObjectURL(zipContent);

        // Create a download link and trigger the download
        const link = document.createElement("a");
        link.href = url;
        link.download = `lerobot_dataset_${new Date()
          .toISOString()
          .replace(/[:.]/g, "-")}.zip`;
        document.body.appendChild(link);
        link.click();

        // Clean up
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 100);

        return zipContent;
    }
  }
}

// Simple record() function API - wraps LeRobotDatasetRecorder
import type {
  RecordConfig,
  RecordProcess,
  RecordingState,
  RecordingData,
  RobotRecordingData,
} from "./types/recording.js";

/**
 * Simple recording function that follows LeRobot.js conventions
 *
 * Records robot motor positions and teleoperation data using a clean function API
 * that matches the patterns established by calibrate() and teleoperate().
 *
 * @param config Recording configuration with explicit teleoperator dependency
 * @returns RecordProcess with start(), stop(), getState(), and result
 *
 * @example
 * ```typescript
 * // 1. Create teleoperation
 * const teleoperationProcess = await teleoperate({
 *   robot: connectedRobot,
 *   teleop: { type: "keyboard" },
 *   calibrationData: calibrationData,
 * });
 *
 * // 2. Create recording with explicit teleoperator dependency
 * const recordProcess = await record({
 *   teleoperator: teleoperationProcess.teleoperator,
 *   options: {
 *     fps: 30,
 *     taskDescription: "Pick and place task",
 *     onDataUpdate: (data) => console.log(`Recorded ${data.frameCount} frames`),
 *   }
 * });
 *
 * // 3. Start both processes
 * teleoperationProcess.start();
 * recordProcess.start();
 *
 * // 4. Stop recording
 * const robotData = await recordProcess.stop();
 * ```
 */
export async function record(config: RecordConfig): Promise<RecordProcess> {
  // Use the provided teleoperator (explicit dependency - good architecture!)
  const recorder = new LeRobotDatasetRecorder(
    [config.teleoperator], // Preserve excellent explicit dependency pattern
    {}, // No video streams in simple API (move complex features to demo)
    config.options?.fps || 30,
    config.options?.taskDescription || "Robot recording"
  );

  let startTime = 0;
  let resultPromise: Promise<RobotRecordingData> | null = null;
  let stateUpdateInterval: NodeJS.Timeout | null = null;

  const recordProcess: RecordProcess = {
    start(): void {
      startTime = Date.now();
      recorder.startRecording();

      // Set up state update polling for simple API callbacks
      if (config.options?.onStateUpdate || config.options?.onDataUpdate) {
        stateUpdateInterval = setInterval(() => {
          if (recorder.isRecording) {
            const state = recordProcess.getState();

            if (config.options?.onStateUpdate) {
              config.options.onStateUpdate(state);
            }

            if (config.options?.onDataUpdate) {
              config.options.onDataUpdate({
                frameCount: state.frameCount,
                currentEpisode: state.episodeCount,
                recentFrames: [], // Simplified for basic API
              });
            }
          }
        }, 100); // 10fps updates for UI responsiveness
      }
    },

    async stop(): Promise<RobotRecordingData> {
      if (stateUpdateInterval) {
        clearInterval(stateUpdateInterval);
        stateUpdateInterval = null;
      }

      const result = await recorder.stopRecording();

      // Convert to simple API format (pure motor data, no video complexity)
      const robotData: RobotRecordingData = {
        episodes: recorder.episodes.map((episode) => episode.frames),
        metadata: {
          fps: config.options?.fps || 30,
          robotType: "unknown", // Could extract from teleoperator if available
          startTime: startTime,
          endTime: Date.now(),
          totalFrames: recorder.teleoperatorData.reduce(
            (sum, ep) => sum + ep.length,
            0
          ),
          totalEpisodes: recorder.teleoperatorData.length,
        },
      };

      return robotData;
    },

    getState(): RecordingState {
      return {
        isActive: recorder.isRecording,
        frameCount: recorder.teleoperatorData.reduce(
          (sum, ep) => sum + ep.length,
          0
        ),
        episodeCount: recorder.teleoperatorData.length,
        duration: recorder.isRecording ? Date.now() - startTime : 0,
        lastUpdate: Date.now(),
      };
    },

    get result(): Promise<RobotRecordingData> {
      if (!resultPromise) {
        resultPromise = new Promise((resolve) => {
          // Return promise that resolves when stop() is called
          const originalStop = recordProcess.stop;
          recordProcess.stop = async () => {
            const data = await originalStop();
            resolve(data);
            return data;
          };
        });
      }
      return resultPromise;
    },
  };

  return recordProcess;
}

import { WebTeleoperator } from "./teleoperators/base-teleoperator";
import { MotorConfig } from "./types/teleoperation";
import * as parquet from "parquet-wasm";
import * as arrow from "apache-arrow";
import JSZip from "jszip";
import generateREADME from "./utils/record/generateREADME";

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
  private robotLabel?: string;

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
    this.robotLabel = undefined;

    for (const [key, stream] of Object.entries(videoStreams)) {
      this.addVideoStream(key, stream);
    }
  }

  setRobotLabel(label: string) {
    this.robotLabel = label;
  }

  private static getSupportedRecorderType(): { mime: string; ext: string } {
    // Prefer H.264 MP4 for viewer compatibility; fall back to WebM
    const candidates: { mime: string; ext: string }[] = [
      { mime: "video/mp4;codecs=h264", ext: "mp4" },
      { mime: "video/mp4", ext: "mp4" },
      { mime: "video/webm;codecs=vp9", ext: "webm" },
      { mime: "video/webm;codecs=vp8", ext: "webm" },
      { mime: "video/webm", ext: "webm" },
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

    // Always start a brand new episode using the next available index
    this.episodeIndex = this.teleoperatorData.length;
    this.teleoperatorData.push(new LeRobotEpisode());
    this.currentVideoSegmentEpisodeIndex = this.episodeIndex;

    // Start recording video streams
    Object.entries(this.videoStreams).forEach(([key, stream]) => {
      // Pick a supported mime/container pair per browser
      const supported =
        this.videoMimeByKey[key] ||
        LeRobotDatasetRecorder.getSupportedRecorderType();
      const { mime, ext } = supported;
      this.videoMimeByKey[key] = { mime, ext };

      // Reset chunks for a clean segment start
      this.videoChunks[key] = [];
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
            // Prepare for any subsequent recording
            this.videoChunks[key] = [];
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
   * Finalizes the current video segment and immediately starts a new one
   * while continuing the recording session. Also advances to the next
   * episode and begins collecting frames under the new episode index.
   *
   * @returns The new episode index
   */
  async nextEpisodeSegment(): Promise<number> {
    if (!this._isRecording) {
      console.warn("nextEpisodeSegment() called while not recording");
      // Ensure episode index points to last episode if any
      this.episodeIndex = Math.max(0, this.teleoperatorData.length - 1);
      return this.episodeIndex;
    }

    const oldSegmentEpisodeIndex =
      this.currentVideoSegmentEpisodeIndex ?? this.episodeIndex;

    // Stop current media recorders and persist the segment blobs under the old episode index
    const stopPromises = Object.entries(this.mediaRecorders).map(
      ([key, recorder]) => {
        return new Promise<void>((resolve) => {
          if (recorder.state === "inactive") {
            resolve();
            return;
          }
          recorder.onstop = () => {
            const chunks = this.videoChunks[key] || [];
            const mime = this.videoMimeByKey[key]?.mime || "video/webm";
            const blob = new Blob(chunks, { type: mime });
            if (!this.videoBlobsByEpisode[oldSegmentEpisodeIndex]) {
              this.videoBlobsByEpisode[oldSegmentEpisodeIndex] = {} as any;
            }
            this.videoBlobsByEpisode[oldSegmentEpisodeIndex][key] = blob;
            // Reset chunks for the next segment
            this.videoChunks[key] = [];
            resolve();
          };
          recorder.stop();
        });
      }
    );

    await Promise.all(stopPromises);

    // Advance to the next episode
    const newEpisodeIndex = this.teleoperatorData.length;
    this.episodeIndex = newEpisodeIndex;
    this.teleoperatorData.push(new LeRobotEpisode());

    // Start new media recorders for the next segment
    Object.entries(this.videoStreams).forEach(([key, stream]) => {
      const supported =
        this.videoMimeByKey[key] ||
        LeRobotDatasetRecorder.getSupportedRecorderType();
      const { mime, ext } = supported;
      this.videoMimeByKey[key] = { mime, ext };

      // Ensure a fresh chunk buffer
      this.videoChunks[key] = [];
      const mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.videoChunks[key].push(event.data);
        }
      };
      this.mediaRecorders[key] = mediaRecorder;
      mediaRecorder.start(1000);
    });

    // Point subsequent stop() to the new episode index
    this.currentVideoSegmentEpisodeIndex = newEpisodeIndex;

    return newEpisodeIndex;
  }

  /**
   * Clears the teleoperator data and video blobs
   */
  clearRecording() {
    this.teleoperatorData = [];
    this.videoBlobs = {};
    this.videoBlobsByEpisode = {} as any;
    // Reset video chunk buffers so future segments don't include cleared data
    for (const key of Object.keys(this.videoChunks)) {
      this.videoChunks[key] = [];
    }
    this.episodeIndex = 0;
    this.currentVideoSegmentEpisodeIndex = null;
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
  // Deprecated for v2.1 exporter; left for backwards-compat APIs
  async generateMetadata(_data: any[]): Promise<any> {
    return {};
  }

  /**
   * Generates statistics for the dataset
   * @returns Statistics object for the LeRobot dataset
   */
  async getStatistics(_data: any[]): Promise<any> {
    return {};
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
  async getEpisodeStatistics(_data: any[]): Promise<Uint8Array> {
    return new Uint8Array();
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
    const regularizedEpisodes = (await this.exportEpisodes("json")) as any[];

    // Build episodes parquet files under data/chunk-000/episode_<id>.parquet
    const parquetEpisodeDataFiles = await this._exportEpisodesToBlob(
      regularizedEpisodes
    );

    // Rewrite parquet file paths to v2.1 layout with chunk folder
    const rewrittenParquet = parquetEpisodeDataFiles.map((file, idx) => {
      return {
        path: `data/chunk-000/episode_${idx
          .toString()
          .padStart(6, "0")}.parquet`,
        content: file.content,
      };
    });

    // Videos: videos/chunk-000/observation.images.<camera>/episode_<id>.<ext>
    const blobArray: { path: string; content: Blob }[] = [...rewrittenParquet];

    const allEpisodeIndices = regularizedEpisodes.map((_: any, i: number) => i);
    const cameraKeySet = new Set<string>();
    const episodesVideoMap: { [ep: number]: { [cam: string]: string } } = {};

    for (const epIdx of allEpisodeIndices) {
      const byCam = this.videoBlobsByEpisode[epIdx] || {};
      episodesVideoMap[epIdx] = {};
      for (const [key, blob] of Object.entries(byCam)) {
        const ext = this.videoMimeByKey[key]?.ext || "mp4";
        const episodeId = epIdx.toString().padStart(6, "0");
        const path = `videos/chunk-000/observation.images.${key}/episode_${episodeId}.${ext}`;
        cameraKeySet.add(key);
        episodesVideoMap[epIdx][key] = path;
        blobArray.push({ path, content: blob });
      }
    }

    // info.json (v2.1)
    const cameras = Array.from(cameraKeySet);
    const numEpisodes = regularizedEpisodes.length;
    const totalFrames = regularizedEpisodes.reduce(
      (sum: number, ep: any) => sum + ep.frames.length,
      0
    );
    // Determine a default video extension for video_path pattern
    let defaultVideoExt = "mp4";
    if (cameras.length > 0) {
      const firstKey = cameras[0];
      const ext = this.videoMimeByKey[firstKey]?.ext;
      if (ext) defaultVideoExt = ext;
    }

    // Build features object
    const features: Record<string, any> = {
      action: {
        dtype: "float32",
        shape: [6],
        names: [
          "main_shoulder_pan",
          "main_shoulder_lift",
          "main_elbow_flex",
          "main_wrist_flex",
          "main_wrist_roll",
          "main_gripper",
        ],
      },
      "observation.state": {
        dtype: "float32",
        shape: [6],
        names: [
          "main_shoulder_pan",
          "main_shoulder_lift",
          "main_elbow_flex",
          "main_wrist_flex",
          "main_wrist_roll",
          "main_gripper",
        ],
      },
      timestamp: { dtype: "float32", shape: [1], names: null },
      frame_index: { dtype: "int64", shape: [1], names: null },
      episode_index: { dtype: "int64", shape: [1], names: null },
      index: { dtype: "int64", shape: [1], names: null },
      task_index: { dtype: "int64", shape: [1], names: null },
    };
    for (const cam of cameras) {
      // Map mime to codec
      const mime = this.videoMimeByKey[cam]?.mime || "video/mp4";
      let codec = "avc1";
      if (mime.includes("vp9")) codec = "vp9";
      else if (mime.includes("vp8")) codec = "vp8";
      features[`observation.images.${cam}`] = {
        dtype: "video",
        shape: [480, 640, 3],
        names: ["height", "width", "channels"],
        info: {
          "video.fps": this.fps,
          "video.height": 480,
          "video.width": 640,
          "video.channels": 3,
          "video.codec": codec,
          "video.pix_fmt": "yuv420p",
          "video.is_depth_map": false,
          has_audio: false,
        },
      };
    }

    const infoJson = {
      version: "2.1",
      // Compatibility fields consumed by visualizers
      total_episodes: numEpisodes,
      total_frames: totalFrames,
      fps: this.fps,
      data_path:
        "data/chunk-{episode_chunk:03d}/episode_{episode_index:06d}.parquet",
      video_path: `videos/chunk-{episode_chunk:03d}/{video_key}/episode_{episode_index:06d}.${defaultVideoExt}`,
      features,
      // Extra descriptive fields
      name: `lerobot_dataset_${new Date().toISOString().slice(0, 10)}`,
      robot: this.robotLabel || "unknown",
      cameras,
      action_space: "joint_position",
      frame_rate: this.fps,
      num_episodes: numEpisodes,
      created_by: "lerobot.js",
      created_at: new Date().toISOString(),
    } as any;

    // episodes.jsonl
    const episodesJsonlLines: string[] = [];
    for (let epIdx = 0; epIdx < numEpisodes; epIdx++) {
      const episodeId = epIdx.toString().padStart(6, "0");
      const length = regularizedEpisodes[epIdx]?.frames.length || 0;
      const videos: any = {};
      Object.entries(episodesVideoMap[epIdx] || {}).forEach(([cam, path]) => {
        videos[cam] = path;
      });
      const row = {
        episode_id: episodeId,
        task: this.taskDescription || "default",
        length,
        videos,
      };
      episodesJsonlLines.push(JSON.stringify(row));
    }

    // tasks.jsonl (single task)
    const tasksJsonl = JSON.stringify({
      task: this.taskDescription || "default",
      description: this.taskDescription || "default",
    });

    // stats.json (minimal)
    const lengths = regularizedEpisodes.map((ep: any) => ep.frames.length);
    const epMin = lengths.length ? Math.min(...lengths) : 0;
    const epMax = lengths.length ? Math.max(...lengths) : 0;
    const epMean = lengths.length
      ? lengths.reduce((a, b) => a + b, 0) / lengths.length
      : 0;
    const statsJson = {
      total_frames: totalFrames,
      episode_lengths: { min: epMin, max: epMax, mean: Math.round(epMean) },
    } as any;

    const readme = this.generateREADME(JSON.stringify(infoJson));

    blobArray.push(
      {
        path: "meta/info.json",
        content: new Blob([JSON.stringify(infoJson, null, 2)], {
          type: "application/json",
        }),
      },
      {
        path: "meta/episodes.jsonl",
        content: new Blob([episodesJsonlLines.join("\n") + "\n"], {
          type: "application/jsonlines",
        }),
      },
      {
        path: "meta/tasks.jsonl",
        content: new Blob([tasksJsonl + "\n"], {
          type: "application/jsonlines",
        }),
      },
      {
        path: "meta/stats.json",
        content: new Blob([JSON.stringify(statsJson, null, 2)], {
          type: "application/json",
        }),
      },
      {
        path: "README.md",
        content: new Blob([readme], { type: "text/markdown" }),
      }
    );

    // episodes_stats.jsonl (v2.1)
    const episodesStatsLines: string[] = [];
    for (let epIdx = 0; epIdx < numEpisodes; epIdx++) {
      const episodeId = epIdx.toString().padStart(6, "0");
      const length = regularizedEpisodes[epIdx]?.frames.length || 0;
      const timestamps = (regularizedEpisodes[epIdx]?.frames || []).map(
        (f: any) => f.timestamp
      );
      const fromTs = timestamps.length ? Math.min(...timestamps) : 0;
      const toTs = timestamps.length ? Math.max(...timestamps) : 0;

      const row: any = {
        episode_id: episodeId,
        "data/chunk_index": 0,
        "data/file": `data/chunk-000/episode_${episodeId}.parquet`,
        length,
      };
      // add per-camera video fields
      const map = episodesVideoMap[epIdx] || {};
      for (const [cam, path] of Object.entries(map)) {
        row[`videos/observation.images.${cam}/chunk_index`] = 0;
        row[`videos/observation.images.${cam}/file`] = path;
        row[`videos/observation.images.${cam}/from_timestamp`] = fromTs;
        row[`videos/observation.images.${cam}/to_timestamp`] = toTs;
      }
      episodesStatsLines.push(JSON.stringify(row));
    }
    blobArray.push({
      path: "meta/episodes_stats.jsonl",
      content: new Blob([episodesStatsLines.join("\n") + "\n"], {
        type: "application/jsonlines",
      }),
    });

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
   * Exports the LeRobot dataset in various formats
   *
   * @param format The export format - 'blobs', 'zip', or 'zip-download'
   * @param options Additional options (currently unused)
   * @returns The exported data in the requested format
   */
  async exportForLeRobot(
    format: "blobs" | "zip" | "zip-download" = "zip-download"
  ) {
    switch (format) {
      case "blobs":
        return this._exportForLeRobotBlobs();

      case "zip":
        return this._exportForLeRobotZip();

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
    [config.teleoperator],
    config.videoStreams || {},
    config.options?.fps || 30,
    config.options?.taskDescription || "Robot recording"
  );

  // Set robot metadata if provided
  if (config.robotType) {
    (recorder as any).setRobotLabel?.(config.robotType);
  }

  let startTime = 0;
  let resultPromise: Promise<RobotRecordingData> | null = null;
  let stateUpdateInterval: NodeJS.Timeout | null = null;

  const recordProcess: RecordProcess = {
    start(): void {
      startTime = Date.now();
      recorder.startRecording();

      // Set up state update polling for callbacks
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
                recentFrames: [],
              });
            }
          }
        }, 100);
      }
    },

    async stop(): Promise<RobotRecordingData> {
      if (stateUpdateInterval) {
        clearInterval(stateUpdateInterval);
        stateUpdateInterval = null;
      }

      const result = await recorder.stopRecording();

      const robotData: RobotRecordingData = {
        episodes: recorder.episodes.map((episode) => episode.frames),
        metadata: {
          fps: config.options?.fps || 30,
          robotType: config.robotType || "unknown",
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

    getEpisodeCount(): number {
      return recorder.teleoperatorData.length;
    },

    getEpisodes(): any[] {
      return recorder.teleoperatorData;
    },

    clearEpisodes(): void {
      (recorder as any).clearRecording();
    },

    async nextEpisode(): Promise<number> {
      return (recorder as any).nextEpisodeSegment();
    },

    restoreEpisodes(episodes: any[]): void {
      (recorder as any).teleoperatorData = [...episodes];
    },

    addCamera(name: string, stream: MediaStream): void {
      (recorder as any).addVideoStream(name, stream);
    },

    removeCamera(name: string): void {
      const videoStreams = (recorder as any).videoStreams || {};
      delete videoStreams[name];
    },

    async exportForLeRobot(
      format: "blobs" | "zip" | "zip-download" = "zip-download"
    ): Promise<any> {
      return recorder.exportForLeRobot(format);
    },
  };

  return recordProcess;
}

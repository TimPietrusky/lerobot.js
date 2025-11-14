/**
 * Types for the simple record() function API
 */

import type { WebTeleoperator } from "../teleoperators/base-teleoperator.js";
import type { LeRobotDatasetRecorder } from "../record.js";

/**
 * Configuration for the record() function
 * Supports both upfront configuration and runtime management
 */
export interface RecordConfig {
  /** The teleoperator to record from (explicit dependency) */
  teleoperator: WebTeleoperator;

  /** Optional: video streams to record by camera name (e.g. { main: videoStream, wrist: videoStream }) */
  videoStreams?: { [cameraName: string]: MediaStream };

  /** Optional: robot type/model name for metadata (e.g. "so100") */
  robotType?: string;

  /** Optional recording configuration */
  options?: {
    /** Target frames per second (default: 30) */
    fps?: number;
    /** Task description for the recording */
    taskDescription?: string;
    /** Callback for real-time recording data updates */
    onDataUpdate?: (data: RecordingData) => void;
    /** Callback for recording state changes */
    onStateUpdate?: (state: RecordingState) => void;
  };
}

/**
 * Process interface returned by record() function
 * Supports flexible upfront config and runtime management
 */
export interface RecordProcess {
  // Recording control
  /** Start recording */
  start(): void;
  /** Stop recording and return the result */
  stop(): Promise<RobotRecordingData>;
  /** Get current recording state */
  getState(): RecordingState;
  /** Promise that resolves when recording is stopped with the data */
  result: Promise<RobotRecordingData>;

  // Episode management (runtime)
  /** Get total number of episodes recorded */
  getEpisodeCount(): number;
  /** Get raw episode data for viewing/analysis */
  getEpisodes(): any[];
  /** Delete all recorded episodes */
  clearEpisodes(): void;
  /** Start a new episode segment and get the new episode index */
  nextEpisode(): Promise<number>;
  /** Restore previously recorded episodes */
  restoreEpisodes(episodes: any[]): void;

  // Camera management (runtime)
  /** Add a camera stream for recording */
  addCamera(name: string, stream: MediaStream): void;
  /** Remove a camera from recording */
  removeCamera(name: string): void;

  // Export
  /** Export the recorded dataset in various formats */
  exportForLeRobot(format?: "blobs" | "zip" | "zip-download"): Promise<any>;
}

/**
 * Current state of the recording process
 */
export interface RecordingState {
  /** Whether recording is currently active */
  isActive: boolean;
  /** Total number of frames recorded */
  frameCount: number;
  /** Number of episodes recorded */
  episodeCount: number;
  /** Duration of current recording in milliseconds */
  duration: number;
  /** Timestamp of last update */
  lastUpdate: number;
}

/**
 * Real-time recording data for UI feedback
 */
export interface RecordingData {
  /** Total frames recorded */
  frameCount: number;
  /** Current episode number */
  currentEpisode: number;
  /** Recent frames for preview (last few frames) */
  recentFrames: any[];
}

/**
 * Final robot recording data (hardware only, no video)
 */
export interface RobotRecordingData {
  /** Recorded episodes with motor position data */
  episodes: any[];
  /** Recording metadata */
  metadata: {
    /** Frames per second */
    fps: number;
    /** Robot type if available */
    robotType: string;
    /** Recording start time */
    startTime: number;
    /** Recording end time */
    endTime: number;
    /** Total frames recorded */
    totalFrames: number;
    /** Total episodes recorded */
    totalEpisodes: number;
  };
}

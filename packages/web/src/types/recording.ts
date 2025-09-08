/**
 * Types for the simple record() function API
 */

import type { WebTeleoperator } from "../teleoperators/base-teleoperator.js";

/**
 * Configuration for the simple record() function
 */
export interface RecordConfig {
  /** The teleoperator to record from (explicit dependency) */
  teleoperator: WebTeleoperator;
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
 */
export interface RecordProcess {
  /** Start recording */
  start(): void;
  /** Stop recording and return the result */
  stop(): Promise<RobotRecordingData>;
  /** Get current recording state */
  getState(): RecordingState;
  /** Promise that resolves when recording is stopped with the data */
  result: Promise<RobotRecordingData>;
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

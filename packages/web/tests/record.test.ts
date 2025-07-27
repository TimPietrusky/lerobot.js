import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import { LeRobotDatasetRecorder } from "../src/record";
import { WebTeleoperator } from "../../web/src/teleoperators/base-teleoperator";

// Mock the WebTeleoperator class
vi.mock("../../web/src/teleoperators/base-teleoperator", () => {
  return {
    WebTeleoperator: vi.fn().mockImplementation(() => {
      return {
        startRecording: vi.fn(),
        stopRecording: vi.fn().mockResolvedValue([]),
        clearRecording: vi.fn()
      };
    })
  };
});

describe("LeRobotDatasetRecorder", () => {
  let recorder: LeRobotDatasetRecorder;
  
  beforeEach(() => {
    // Create a new recorder instance before each test
    // @ts-ignore
    const mockTeleoperator = new WebTeleoperator() as unknown as WebTeleoperator;
    const mockVideoStreams = {};
    recorder = new LeRobotDatasetRecorder([mockTeleoperator], mockVideoStreams, 30);
  });

  describe("_interpolateAndCompleteLerobotData", () => {
    it("should interpolate data to match the specified fps", async () => {
      // Create test data with non-regular timestamps
      const roughData = [
        {
          timestamp: 0,
          action: {
            shoulder_pan: 0,
            shoulder_lift: 0,
            elbow_flex: 0,
            wrist_flex: 0,
            wrist_roll: 0,
            gripper: 0
          },
          "observation.state": {
            shoulder_pan: 0,
            shoulder_lift: 0,
            elbow_flex: 0,
            wrist_flex: 0,
            wrist_roll: 0,
            gripper: 0
          },
          episode_index: 0,
          task_index: 0
        },
        {
          timestamp: 0.5,
          action: {
            shoulder_pan: 10,
            shoulder_lift: 20,
            elbow_flex: 30,
            wrist_flex: 40,
            wrist_roll: 50,
            gripper: 60
          },
          "observation.state": {
            shoulder_pan: 15,
            shoulder_lift: 25,
            elbow_flex: 35,
            wrist_flex: 45,
            wrist_roll: 55,
            gripper: 65
          },
          episode_index: 0,
          task_index: 0
        },
        {
          timestamp: 1.0,
          action: {
            shoulder_pan: 20,
            shoulder_lift: 40,
            elbow_flex: 60,
            wrist_flex: 80,
            wrist_roll: 100,
            gripper: 120
          },
          "observation.state": {
            shoulder_pan: 30,
            shoulder_lift: 50,
            elbow_flex: 70,
            wrist_flex: 90,
            wrist_roll: 110,
            gripper: 130
          },
          episode_index: 1, // New episode
          task_index: 0
        },
        {
            timestamp: 1.5,
            action: {
              shoulder_pan: 25,
              shoulder_lift: 50,
              elbow_flex: 75,
              wrist_flex: 100,
              wrist_roll: 125,
              gripper: 150
            },
            "observation.state": {
              shoulder_pan: 35,
              shoulder_lift: 55,
              elbow_flex: 75,
              wrist_flex: 95,
              wrist_roll: 115,
              gripper: 135
            },
            episode_index: 1, // New episode
            task_index: 0
          }
      ];

      // Set the FPS to 10 for this test
      const fps = 10;
      
      // Call the method under test
      const result = await recorder._interpolateAndCompleteLerobotData(fps, roughData);

      // log all the results, row by row
      for (let i = 0; i < result.length; i++) {
        console.log(result[i]);
      }
      
      // Verify the results
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(15); // 1.5 seconds at 10 fps = 15 frames
      
      // Check the first frame
      expect(result[0].timestamp).toBeCloseTo(0, 5);
      expect(result[0].action).toEqual([0, 0, 0, 0, 0, 0]);
      expect(result[0]["observation.state"]).toEqual([0, 0, 0, 0, 0, 0]);
      expect(result[0].episode_index).toBe(0);
      expect(result[0].task_index).toBe(0);
      expect(result[0].frame_index).toBe(0);
      expect(result[0].index).toBe(0);
      
      // Check a middle frame (0.3 seconds)
      const middleFrame = result[3];
      expect(middleFrame.timestamp).toBeCloseTo(0.3, 5);
      // At 0.3 seconds, we're 60% between 0 and 0.5 seconds
      // So action.shoulder_pan should be 60% of 10 = 6
      expect(middleFrame.action[0]).toBeCloseTo(6, 5);
      expect(middleFrame.episode_index).toBe(0);
      expect(middleFrame.frame_index).toBe(3);
      expect(middleFrame.index).toBe(3);
      
      // Check the frame right after the episode change
      const episodeChangeFrame = result[5]; // 0.5 seconds
      expect(episodeChangeFrame.timestamp).toBeCloseTo(0.5, 5);
      expect(episodeChangeFrame.action[0]).toBeCloseTo(10, 5);
      expect(episodeChangeFrame.episode_index).toBe(0);
      expect(episodeChangeFrame.frame_index).toBe(5);
      
      // Check the last frame before 1 second
      const lastFrame = result[9]; // 0.9 seconds
      expect(lastFrame.timestamp).toBeCloseTo(0.9, 5);
      expect(lastFrame.episode_index).toBe(0);
      expect(lastFrame.frame_index).toBe(9); // Frame index continues incrementing
      expect(lastFrame.index).toBe(9);
    });

    it("should handle episode index changes correctly", async () => {
      // Create test data with episode changes
      const roughData = [
        { timestamp: 0.0, action: { shoulder_pan: 0 }, "observation.state": { shoulder_pan: 0 }, episode_index: 0, task_index: 0 },
        { timestamp: 0.3, action: { shoulder_pan: 30 }, "observation.state": { shoulder_pan: 30 }, episode_index: 0, task_index: 0 },
        { timestamp: 0.5, action: { shoulder_pan: 50 }, "observation.state": { shoulder_pan: 50 }, episode_index: 1, task_index: 0 }, // Episode change
        { timestamp: 0.8, action: { shoulder_pan: 80 }, "observation.state": { shoulder_pan: 80 }, episode_index: 1, task_index: 0 },
        { timestamp: 1.0, action: { shoulder_pan: 100 }, "observation.state": { shoulder_pan: 100 }, episode_index: 2, task_index: 0 } // Another episode change
      ];

      const fps = 10;
      const result = await recorder._interpolateAndCompleteLerobotData(fps, roughData);
      
      // Check frame indices reset after episode changes
      expect(result[0].episode_index).toBe(0);
      expect(result[0].frame_index).toBe(0);
      
      expect(result[5].episode_index).toBe(1); // After episode change
      expect(result[5].frame_index).toBe(0); // Should reset to 0
      
      expect(result[9].episode_index).toBe(1); // After second episode change
      expect(result[9].frame_index).toBe(4); // Frame index continues incrementing
    });
    
    it("should handle empty or minimal data", async () => {
      // Test with minimal data (just two points)
      const minimalData = [
        { timestamp: 0.0, action: { shoulder_pan: 0 }, "observation.state": { shoulder_pan: 0 }, episode_index: 0, task_index: 0 },
        { timestamp: 0.1, action: { shoulder_pan: 10 }, "observation.state": { shoulder_pan: 10 }, episode_index: 0, task_index: 0 }
      ];
      
      const fps = 10;
      const result = await recorder._interpolateAndCompleteLerobotData(fps, minimalData);
      
      expect(result.length).toBe(1); // 0.1 seconds at 10fps = 1 frame
      expect(result[0].timestamp).toBeCloseTo(0, 5);
      expect(result[0].action[0]).toBeCloseTo(0, 5);
    });
  });
});

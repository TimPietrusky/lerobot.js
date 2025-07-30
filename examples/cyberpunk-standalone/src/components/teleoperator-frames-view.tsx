"use client";

import { NonIndexedLeRobotDatasetRow } from "@lerobot/web";
import { TeleoperatorJointGraph } from "./teleoperator-joint-graph";

interface TeleoperatorFramesViewProps {
  frames: NonIndexedLeRobotDatasetRow[];
}

export function TeleoperatorFramesView({ frames }: TeleoperatorFramesViewProps) {
  // Joint names in the order they appear in the arrays
  const jointNames = [
    "shoulder_pan", 
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper"
  ];

  // Helper function to format an object as a column of key-value pairs with joint names
  const formatArrayAsColumn = (obj: Record<number, number>): string => {
    return Object.entries(obj)
      .map(([key, value]) => {
        // Convert numeric key to joint name if possible
        const index = parseInt(key);
        const jointName = !isNaN(index) && index < jointNames.length ? jointNames[index] : key;
        return `${jointName}: ${value}`;
      })
      .join('\n');
  };
  
  return (
    <div className="ml-8 mr-4 mb-2">
      {/* Joint visualization graph */}
      <TeleoperatorJointGraph frames={frames} />
      
      {/* Frames container with horizontal scroll */}
      <div className="bg-gray-800/50 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        {/* Frames header */}
        <table className="w-full min-w-max table-fixed">
          <thead>
            <tr className="text-xs font-medium bg-gray-800/80 text-gray-300">
              <th className="w-16 px-2 py-1 text-left">Frame</th>
              <th className="w-64 px-2 py-1 text-left">Timestamp</th>
              <th className="w-[300px] px-2 py-1 text-left">Action</th>
              <th className="w-[500px] px-2 py-1 text-left">State</th>
            </tr>
          </thead>
          
          {/* Frame rows */}
          <tbody className="max-h-60 overflow-y-auto">
            {frames.map((frame: NonIndexedLeRobotDatasetRow, frameIndex: number) => (
              <tr key={frameIndex} className="text-xs border-t border-gray-700/50">
                <td className="w-16 px-2 py-1 font-mono whitespace-nowrap">{frameIndex}</td>
                <td className="w-64 px-2 py-1 font-mono whitespace-nowrap">
                  {frame.timestamp}
                </td>
                <td className="w-[200px] px-2 py-1 font-mono whitespace-pre-wrap align-top">
                  {Object.keys(frame.action).length > 0 ? 
                    formatArrayAsColumn(frame.action) : 
                    '-'}
                </td>
                <td className="w-[300px] px-2 py-1 font-mono whitespace-pre-wrap align-top">
                  {Object.keys(frame["observation.state"]).length > 0 ? 
                    formatArrayAsColumn(frame["observation.state"]) : 
                    '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

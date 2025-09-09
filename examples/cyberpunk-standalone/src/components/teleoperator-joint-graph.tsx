import React, { memo, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { NonIndexedLeRobotDatasetRow } from "@lerobot/web";

interface TeleoperatorJointGraphProps {
  frames: NonIndexedLeRobotDatasetRow[];
  refreshTick?: number;
}

const MAX_POINTS = 5000;

export const TeleoperatorJointGraph = memo(function TeleoperatorJointGraph({
  frames,
  refreshTick,
}: TeleoperatorJointGraphProps) {
  // Skip rendering if no frames
  if (!frames || frames.length === 0) {
    return null;
  }

  // Use hardcoded joint names that match the LeRobot dataset format
  const jointNames = [
    "shoulder_pan",
    "shoulder_lift",
    "elbow_flex",
    "wrist_flex",
    "wrist_roll",
    "gripper",
  ];

  // Generate a color palette for the joints
  const colors = [
    "#8884d8",
    "#82ca9d",
    "#ffc658",
    "#ff8042",
    "#0088fe",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#a4de6c",
    "#d0ed57",
  ];

  // Prepare data for the chart - handling arrays
  const chartData = useMemo(
    () =>
      frames.map((frame, index) => {
        // Create base data point with index
        const dataPoint: any = {
          name: index,
          timestamp: frame.timestamp,
        };

        // Add action values (assuming action is an array)
        if (Array.isArray(frame.action)) {
          // Map each array index to the corresponding joint name
          jointNames.forEach((jointName, i) => {
            if (i < frame.action.length) {
              dataPoint[`action_${jointName}`] = frame.action[i];
            }
          });
        }

        // Add observation state values (assuming observation.state is an array)
        if (Array.isArray(frame["observation.state"])) {
          // Map each array index to the corresponding joint name
          jointNames.forEach((jointName, i) => {
            if (i < frame["observation.state"].length) {
              dataPoint[`state_${jointName}`] = frame["observation.state"][i];
            }
          });
        }

        return dataPoint;
      }),
    [frames, refreshTick]
  );

  const limitedData = useMemo(() => {
    if (!chartData) return [] as typeof chartData;
    const len = chartData.length;
    if (len <= MAX_POINTS) return chartData;
    return chartData.slice(len - MAX_POINTS, len);
  }, [chartData]);

  // Create lines for each joint
  const linesToRender = jointNames.flatMap((jointName) => [
    {
      key: `action_${jointName}`,
      dataKey: `action_${jointName}`,
      name: `Action: ${jointName}`,
      isDotted: true,
    },
    {
      key: `state_${jointName}`,
      dataKey: `state_${jointName}`,
      name: `State: ${jointName}`,
      isDotted: false,
    },
  ]);

  return (
    <div className="w-full bg-gray-800/50 rounded-md p-4 mb-4">
      <h3 className="text-sm font-medium text-gray-300 mb-2">
        Joint Positions Over Time
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={limitedData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />
          <XAxis
            dataKey="name"
            label={{
              value: "Frame Index",
              position: "insideBottomRight",
              offset: -10,
            }}
            stroke="#aaa"
          />
          <YAxis stroke="#aaa" />
          <Tooltip
            contentStyle={{ backgroundColor: "#333", borderColor: "#555" }}
            labelStyle={{ color: "#eee" }}
            itemStyle={{ color: "#eee" }}
          />
          <Legend />

          {/* Render all lines */}
          {linesToRender.map((lineConfig, index) => {
            const jointName = lineConfig.dataKey.replace(
              /^(action|state)_/,
              ""
            );
            const jointIndex = jointNames.indexOf(jointName);
            const colorIndex =
              jointIndex >= 0 ? jointIndex : index % colors.length;

            return (
              <Line
                key={lineConfig.key}
                type="monotone"
                dataKey={lineConfig.dataKey}
                name={lineConfig.name}
                stroke={colors[colorIndex]}
                strokeDasharray={lineConfig.isDotted ? "5 5" : undefined}
                dot={false}
                activeDot={{ r: 4 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

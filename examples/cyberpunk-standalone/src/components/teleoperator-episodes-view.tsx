"use client";

import { useState } from "react";
import { LeRobotEpisode } from "@lerobot/web";
import { TeleoperatorFramesView } from "./teleoperator-frames-view";
import { Button } from "./ui/button";

interface TeleoperatorEpisodesViewProps {
  teleoperatorData?: LeRobotEpisode[];
  isRecording?: boolean;
  refreshTick?: number;
}

export function TeleoperatorEpisodesView({
  teleoperatorData,
  isRecording,
  refreshTick,
}: TeleoperatorEpisodesViewProps) {
  // State to track which episodes are expanded
  const [expandedEpisodes, setExpandedEpisodes] = useState<
    Record<number, boolean>
  >({});

  const formatSeconds = (s: number): string => {
    if (!Number.isFinite(s)) return String(s);
    return s.toFixed(3);
  };

  // Toggle expanded state for an episode
  const toggleEpisode = (index: number) => {
    setExpandedEpisodes((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm text-center text-muted-foreground mb-2">
        List of recorded episodes
      </div>
      <div className="flex flex-col gap-1">
        {/* Header */}
        <div className="flex flex-row font-medium text-sm">
          <div className="flex-1 px-4 py-2">id</div>
          <div className="flex-1 px-4 py-2">time length</div>
          <div className="flex-1 px-4 py-2">frames</div>
        </div>

        {/* Body */}
        {teleoperatorData && teleoperatorData.length > 0 ? (
          teleoperatorData.map((episode: LeRobotEpisode, i: number) => (
            <div key={i} className="flex flex-col border-t border-gray-700">
              {/* Episode row */}
              <div className="flex flex-row">
                <div className="flex-1 px-4 py-2 font-mono">{i}</div>
                <div className="flex-1 px-4 py-2 font-mono">
                  {formatSeconds(episode.timespan)}
                </div>
                <div className="flex-1 px-4 py-2 font-mono">
                  {episode.length}
                </div>
                <div
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => toggleEpisode(i)}
                >
                  {expandedEpisodes[i] ? (
                    <Button>hide frames</Button>
                  ) : (
                    <Button>show frames</Button>
                  )}
                </div>
              </div>

              {/* Frames (collapsible) */}
              {expandedEpisodes[i] && (
                <TeleoperatorFramesView
                  frames={episode.frames}
                  isRecording={isRecording}
                  refreshTick={refreshTick}
                />
              )}
            </div>
          ))
        ) : (
          <div className="flex flex-row border-t border-gray-700">
            <div className="flex-1 px-4 py-4 text-center text-muted-foreground">
              No episodes recorded yet. Click "Start Recording" to begin.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

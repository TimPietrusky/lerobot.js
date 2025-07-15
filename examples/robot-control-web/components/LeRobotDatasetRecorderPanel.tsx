import React, { useState, useEffect } from 'react';
import { LeRobotDatasetRecorder } from '../../../packages/web/src/record';

interface LeRobotDatasetRecorderPanelProps {
  recorder: LeRobotDatasetRecorder;
  className?: string;
}

/**
 * A panel for controlling LeRobot dataset recording with start, stop, and export functionality
 */
export const LeRobotDatasetRecorderPanel: React.FC<LeRobotDatasetRecorderPanelProps> = ({
  recorder,
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [episodeIndex, setEpisodeIndex] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  
  // Update recording status
  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder]);

  // Timer for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const handleStartRecording = () => {
    try {
      recorder.setEpisodeIndex(episodeIndex);
      recorder.setTaskIndex(taskIndex);
      recorder.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const handleStopRecording = async () => {
    try {
      await recorder.stopRecording();
      setIsRecording(false);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  const handleExportTeleoperatorData = async () => {
    if (isRecording) {
      alert('Please stop recording before exporting data');
      return;
    }
    
    setIsExporting(true);
    await recorder.exportForLeRobot();
    setIsExporting(false);
  };

  const handleExportFullData = async () => {
    if (isRecording) {
      alert('Please stop recording before exporting data');
      return;
    }
    
    try {
      setIsExporting(true);
      await recorder.exportForLeRobot();
      setIsExporting(false);
    } catch (error) {
      console.error('Failed to export full data:', error);
      setIsExporting(false);
    }
  };

  const handleEpisodeIndexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setEpisodeIndex(isNaN(value) ? 0 : value);
    if (!isRecording) {
      recorder.setEpisodeIndex(isNaN(value) ? 0 : value);
    }
  };

  const handleTaskIndexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setTaskIndex(isNaN(value) ? 0 : value);
    if (!isRecording) {
      recorder.setTaskIndex(isNaN(value) ? 0 : value);
    }
  };

  return (
    <div className={`lerobot-recorder-panel ${className}`}>
      <h3>Dataset Recorder</h3>
      
      <div className="recorder-status">
        Status: <span className={isRecording ? 'recording' : 'idle'}>
          {isRecording ? 'Recording' : 'Idle'}
        </span>
        {isRecording && (
          <span className="duration"> ({recordingDuration}s)</span>
        )}
      </div>
      
      <div className="recorder-controls">
        <div className="input-group">
          <label htmlFor="episode-index">Episode Index:</label>
          <input 
            id="episode-index"
            type="number" 
            min="0" 
            value={episodeIndex}
            onChange={handleEpisodeIndexChange}
            disabled={isRecording}
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="task-index">Task Index:</label>
          <input 
            id="task-index"
            type="number" 
            min="0" 
            value={taskIndex}
            onChange={handleTaskIndexChange}
            disabled={isRecording}
          />
        </div>
      </div>
      
      <div className="button-container">
        {!isRecording ? (
          <button 
            className="start-button" 
            onClick={handleStartRecording}
            disabled={isExporting}
          >
            Start Recording
          </button>
        ) : (
          <button 
            className="stop-button" 
            onClick={handleStopRecording}
            disabled={isExporting}
          >
            Stop Recording
          </button>
        )}
      </div>
      
      <div className="export-container">
        <button 
          onClick={handleExportTeleoperatorData}
          disabled={isRecording || isExporting}
          className="export-button"
        >
          {isExporting ? 'Exporting...' : 'Export Teleoperator Data'}
        </button>
        
        <button 
          onClick={handleExportFullData}
          disabled={isRecording || isExporting}
          className="export-button"
        >
          {isExporting ? 'Exporting...' : 'Export Full Dataset (incl. Video)'}
        </button>
      </div>
      
      <style>{`
        .lerobot-recorder-panel {
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 5px;
          background-color: #f8f8f8;
          margin-bottom: 15px;
        }
        
        h3 {
          margin-top: 0;
          margin-bottom: 15px;
        }
        
        .recorder-status {
          margin-bottom: 15px;
          font-weight: bold;
        }
        
        .recording {
          color: #d9534f;
        }
        
        .idle {
          color: #5cb85c;
        }
        
        .recorder-controls {
          display: flex;
          gap: 15px;
          margin-bottom: 15px;
        }
        
        .input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .input-group input {
          width: 60px;
          padding: 5px;
        }
        
        .button-container {
          margin-bottom: 15px;
        }
        
        .start-button {
          background-color: #5cb85c;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .stop-button {
          background-color: #d9534f;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        
        .export-container {
          display: flex;
          gap: 10px;
        }
        
        .export-button {
          background-color: #5bc0de;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          flex: 1;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
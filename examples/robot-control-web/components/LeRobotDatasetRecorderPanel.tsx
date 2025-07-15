import React, { useState, useEffect, useRef } from 'react';
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
  const streamOptions = ['front', 'side', 'distance'];
  const [streamName, setStreamName] = useState(streamOptions[0]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStreams, setVideoStreams] = useState<{[key: string]: MediaStream}>({});
  
  // Update recording status
  useEffect(() => {
    setIsRecording(recorder.isRecording);
  }, [recorder]);
  
  // Function to get available video devices with proper permissions
  const refreshCameraDevices = async () => {
    try {
      // First request camera permissions by accessing a temporary stream
      // This ensures we get labeled devices with proper names
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Stop the temporary stream immediately after getting permissions
      tempStream.getTracks().forEach(track => track.stop());
      
      // Now get the full list of devices with proper labels
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      // Filter for video inputs
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      setVideoDevices(videoInputs);
      
      // Set the first device as default if available and none is selected
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
      
      return true;
    } catch (error) {
      console.error('Error accessing camera devices:', error);
      alert('Failed to access camera devices. Please make sure you have cameras connected and have granted permission to use them.');
      return false;
    }
  };
  
  // Initial device enumeration
  useEffect(() => {
    refreshCameraDevices();
  }, []);

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
  
  const handleStreamNameChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStreamName(e.target.value);
  };
  
  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeviceId(e.target.value);
  };
  
  const handleAddVideoStream = async () => {
    if (!streamName || !selectedDeviceId) {
      alert('Please provide a stream name and select a device');
      return;
    }
    
    if (isRecording) {
      alert('Cannot add video streams while recording');
      return;
    }
    
    try {
      // Get media stream from selected device
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } },
        audio: false
      });
      
      // Save the stream to our local state
      setVideoStreams(prev => ({
        ...prev,
        [streamName]: stream
      }));
      
      // Add the stream to the recorder
      recorder.addVideoStream(streamName, stream);
      
      // Reset the form
      setStreamName('');
      
      // Show the stream in the preview video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error: any) {
      console.error('Error accessing video device:', error);
      alert(`Failed to access video device: ${error.message || 'Unknown error'}`);
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
      
      <div className="video-stream-section">
        <h4>Add Video Streams</h4>
        <button
          onClick={refreshCameraDevices}
          className="refresh-devices-button"
          disabled={isRecording}
        >
          Request Camera Permissions
        </button>
        <div className="video-stream-controls">
          <div className="input-group">
            <label htmlFor="stream-name">Stream Name:</label>
            <select
              id="stream-name"
              value={streamName}
              onChange={handleStreamNameChange}
              disabled={isRecording}
            >
              {streamOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div className="input-group">
            <label htmlFor="video-device">Video Device:</label>
            <select
              id="video-device"
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              disabled={isRecording}
            >
              {videoDevices.length === 0 ? (
                <option value="">No devices found</option>
              ) : (
                videoDevices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.substring(0, 8)}...`}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <button 
            onClick={handleAddVideoStream}
            disabled={isRecording || !streamName || !selectedDeviceId}
            className="add-stream-button"
          >
            Add Video Stream
          </button>
        </div>
        
        <div className="video-preview">
          <video 
            ref={videoRef} 
            width="320" 
            height="240" 
            autoPlay 
            muted 
            playsInline
          />
        </div>
        
        {Object.keys(videoStreams).length > 0 && (
          <div className="added-streams">
            <h4>Added Video Streams:</h4>
            <ul>
              {Object.keys(videoStreams).map(key => (
                <li key={key}>{key}</li>
              ))}
            </ul>
          </div>
        )}
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
        
        h4 {
          margin-top: 20px;
          margin-bottom: 10px;
          color: #333;
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
          margin-bottom: 10px;
        }
        
        .input-group input {
          width: 60px;
          padding: 5px;
        }
        
        .input-group input#stream-name {
          width: 150px;
        }
        
        .input-group select {
          width: 200px;
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
        
        .video-stream-section {
          margin: 20px 0;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
        
        .refresh-devices-button {
          background-color: #5bc0de;
          color: white;
          padding: 6px 12px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-bottom: 15px;
          font-size: 0.9em;
        }
        
        .video-stream-controls {
          margin-bottom: 15px;
        }
        
        .add-stream-button {
          background-color: #428bca;
          color: white;
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          margin-top: 10px;
        }
        
        .video-preview {
          margin: 15px 0;
          background-color: #000;
          border-radius: 4px;
          overflow: hidden;
          width: 320px;
          height: 240px;
        }
        
        .video-preview video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .added-streams {
          margin-top: 15px;
          padding: 10px;
          background-color: #eee;
          border-radius: 4px;
        }
        
        .added-streams ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .added-streams li {
          margin-bottom: 5px;
        }
        
        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};
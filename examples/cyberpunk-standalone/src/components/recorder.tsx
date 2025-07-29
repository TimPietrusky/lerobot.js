"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Disc as Record,
  Download,
  Upload,
  PlusCircle,
  Square,
  Camera,
  Trash2,
} from "lucide-react";
import { LeRobotDatasetRecorder, LeRobotDatasetRow, NonIndexedLeRobotDatasetRow, LeRobotEpisode } from "@lerobot/web";
import { TeleoperatorEpisodesView } from "./teleoperator-episodes-view";

interface RecorderProps {
  teleoperators: any[];
  robot: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onNeedsTeleoperation: () => Promise<boolean>;
  videoStreams?: { [key: string]: MediaStream };
}



export function Recorder({
  teleoperators,
  robot,
  onNeedsTeleoperation,
}: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [huggingfaceApiKey, setHuggingfaceApiKey] = useState("");
  const [cameraName, setCameraName] = useState("");
  const [additionalCameras, setAdditionalCameras] = useState<{
    [key: string]: MediaStream;
  }>({});
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>(
    []
  );
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isLoadingCameras, setIsLoadingCameras] = useState(false);
  const [cameraPermissionState, setCameraPermissionState] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const [showCameraConfig, setShowCameraConfig] = useState(false);
  const [hasRecordedFrames, setHasRecordedFrames] = useState(false);
  const recorderRef = useRef<LeRobotDatasetRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { toast } = useToast();

  // Initialize the recorder when teleoperators are available
  useEffect(() => {
    if (teleoperators.length > 0) {
      recorderRef.current = new LeRobotDatasetRecorder(
        teleoperators,
        additionalCameras,
        30, // fps
        "Robot teleoperation recording"
      );
    }
  }, [teleoperators, additionalCameras]);

  const handleStartRecording = async () => {
    // If teleoperators aren't available, initialize teleoperation first
    if (teleoperators.length === 0) {
      toast({
        title: "Initializing...",
        description: `Setting up robot control for ${robot.robotId || "robot"}`,
      });

      const success = await onNeedsTeleoperation();
      if (!success) {
        toast({
          title: "Recording Error",
          description: "Failed to initialize robot control",
          variant: "destructive",
        });
        return;
      }

      // Wait a moment for the recorder to initialize with new teleoperators
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!recorderRef.current) {
      toast({
        title: "Recording Error",
        description: "Recorder not ready yet. Please try again.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Set the episode index
      recorderRef.current.setEpisodeIndex(currentEpisode);
      recorderRef.current.setTaskIndex(0); // Default task index

      // Start recording
      recorderRef.current.startRecording();
      setIsRecording(true);
      setHasRecordedFrames(true);

      toast({
        title: "Recording Started",
        description: `Episode ${currentEpisode} is now recording`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to start recording";
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current || !isRecording) {
      return;
    }

    try {
      const result = await recorderRef.current.stopRecording();
      setIsRecording(false);

      toast({
        title: "Recording Stopped",
        description: `Episode ${currentEpisode} completed with ${result.teleoperatorData.length} frames`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to stop recording";
      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleNextEpisode = () => {
    // Make sure we're not recording
    if (isRecording) {
      handleStopRecording();
    }

    // Increment episode counter
    setCurrentEpisode((prev) => prev + 1);

    toast({
      title: "New Episode",
      description: `Ready to record episode ${currentEpisode + 1}`,
    });
  };

  // Reset frames by clearing the recorder data
  const handleResetFrames = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    }

    if (recorderRef.current) {
      recorderRef.current.clearRecording();
      setHasRecordedFrames(false);

      toast({
        title: "Frames Reset",
        description: "All recorded frames have been cleared",
      });
    }
  }, [isRecording, toast]);

  // Load available cameras
  const loadAvailableCameras = useCallback(
    async (isAutoLoad = false) => {
      if (isLoadingCameras) return;

      setIsLoadingCameras(true);

      try {
        // Check if we already have permission
        const permission = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });
        setCameraPermissionState(
          permission.state === "granted"
            ? "granted"
            : permission.state === "denied"
            ? "denied"
            : "unknown"
        );

        let tempStream: MediaStream | null = null;

        // Try to enumerate devices first (works if we have permission)
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(
          (device) => device.kind === "videoinput"
        );

        // If devices have labels, we already have permission
        const hasLabels = videoDevices.some((device) => device.label);

        if (!hasLabels && videoDevices.length > 0) {
          // Need to request permission to get device labels
          tempStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });

          // Re-enumerate to get labels
          const devicesWithLabels =
            await navigator.mediaDevices.enumerateDevices();
          const videoDevicesWithLabels = devicesWithLabels.filter(
            (device) => device.kind === "videoinput"
          );
          setAvailableCameras(videoDevicesWithLabels);

          if (!isAutoLoad) {
            console.log(
              `Found ${videoDevicesWithLabels.length} video devices:`,
              videoDevicesWithLabels.map((d) => d.label || d.deviceId)
            );
          }
        } else {
          setAvailableCameras(videoDevices);
          if (!isAutoLoad) {
            console.log(
              `Found ${videoDevices.length} video devices:`,
              videoDevices.map((d) => d.label || d.deviceId)
            );
          }
        }

        // Auto-select and preview first camera if none selected
        if (videoDevices.length > 0 && !selectedCameraId) {
          const firstCameraId = videoDevices[0].deviceId;
          setSelectedCameraId(firstCameraId);

          // Start preview with first camera
          if (tempStream) {
            setPreviewStream(tempStream);
          } else {
            // Create fresh stream for first camera
            const firstCameraStream = await navigator.mediaDevices.getUserMedia(
              {
                video: {
                  deviceId: { exact: firstCameraId },
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
              }
            );
            setPreviewStream(firstCameraStream);
          }
          setCameraPermissionState("granted");
        } else if (tempStream) {
          // Stop temp stream if we didn't use it
          tempStream.getTracks().forEach((track) => track.stop());
        }
      } catch (error) {
        setCameraPermissionState("denied");
        if (!isAutoLoad) {
          toast({
            title: "Camera Error",
            description: `Failed to load cameras: ${
              error instanceof Error ? error.message : String(error)
            }`,
            variant: "destructive",
          });
        }
      } finally {
        setIsLoadingCameras(false);
      }
    },
    [selectedCameraId, toast]
  );

  // Switch camera preview
  const switchCameraPreview = useCallback(
    async (deviceId: string) => {
      try {
        // Stop current preview stream
        if (previewStream) {
          previewStream.getTracks().forEach((track) => track.stop());
        }

        // Start new stream with selected camera
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        setPreviewStream(newStream);
        setSelectedCameraId(deviceId);
      } catch (error) {
        toast({
          title: "Camera Error",
          description: `Failed to switch camera: ${
            error instanceof Error ? error.message : String(error)
          }`,
          variant: "destructive",
        });
      }
    },
    [previewStream, toast]
  );

  // Add a new camera to the recorder
  const handleAddCamera = useCallback(async () => {
    if (!cameraName.trim()) {
      toast({
        title: "Camera Error",
        description: "Please enter a camera name",
        variant: "destructive",
      });
      return;
    }

    if (hasRecordedFrames) {
      toast({
        title: "Camera Error",
        description: "Cannot add cameras after recording has started",
        variant: "destructive",
      });
      return;
    }

    if (!selectedCameraId) {
      toast({
        title: "Camera Error",
        description: "Please select a camera first",
        variant: "destructive",
      });
      return;
    }

    try {
      // Use the current preview stream (already running with correct camera)
      if (!previewStream) {
        throw new Error("No camera preview available");
      }

      // Clone the stream for recording (keep preview running)
      const recordingStream = previewStream.clone();

      // Add the new camera to our state
      setAdditionalCameras((prev) => ({
        ...prev,
        [cameraName]: recordingStream,
      }));

      setCameraName(""); // Clear the input

      toast({
        title: "Camera Added",
        description: `Camera "${cameraName}" has been added to the recorder`,
      });
    } catch (error) {
      toast({
        title: "Camera Error",
        description: `Failed to access camera: ${
          error instanceof Error ? error.message : String(error)
        }`,
        variant: "destructive",
      });
    }
  }, [cameraName, hasRecordedFrames, selectedCameraId, toast]);

  // Remove a camera from the recorder
  const handleRemoveCamera = useCallback(
    (name: string) => {
      if (hasRecordedFrames) {
        toast({
          title: "Camera Error",
          description: "Cannot remove cameras after recording has started",
          variant: "destructive",
        });
        return;
      }

      setAdditionalCameras((prev) => {
        const newCameras = { ...prev };
        if (newCameras[name]) {
          // Stop the stream tracks
          newCameras[name].getTracks().forEach((track) => track.stop());
          delete newCameras[name];
        }
        return newCameras;
      });

      toast({
        title: "Camera Removed",
        description: `Camera "${name}" has been removed`,
      });
    },
    [hasRecordedFrames, toast]
  );

  // Auto-load cameras on component mount (only once)
  useEffect(() => {
    loadAvailableCameras(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once

  // Handle video stream assignment
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  // Cleanup preview stream on unmount
  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewStream]);

  const handleDownloadZip = async () => {
    if (!recorderRef.current) {
      toast({
        title: "Download Error",
        description: "Recorder not initialized",
        variant: "destructive",
      });
      return;
    }

    await recorderRef.current.exportForLeRobot("zip-download");
    toast({
      title: "Download Started",
      description: "Your dataset is being downloaded as a ZIP file",
    });
  };

  const handleUploadToHuggingFace = async () => {
    if (!recorderRef.current) {
      toast({
        title: "Upload Error",
        description: "Recorder not initialized",
        variant: "destructive",
      });
      return;
    }

    if (!huggingfaceApiKey) {
      toast({
        title: "Upload Error",
        description: "Please enter your HuggingFace API key",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Upload Started",
        description: "Uploading dataset to HuggingFace...",
      });

      // Generate a unique repository name
      const repoName = `lerobot-recording-${Date.now()}`;

      const uploader = await recorderRef.current.exportForLeRobot(
        "huggingface",
        {
          repoName,
          accessToken: huggingfaceApiKey,
        }
      );

      uploader.addEventListener("progress", (event: Event) => {
        console.log(event);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to upload to HuggingFace";
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Helper function to format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <Card className="border-0 rounded-none mt-6">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-1 h-8 bg-primary"></div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">
                robot movement recorder
              </h3>
              <p className="text-sm text-muted-foreground font-mono">
                dataset <span className="text-muted-foreground">recording</span>{" "}
                interface
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="border-l border-white/10 pl-6 flex items-center gap-4">
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={handleResetFrames}
                disabled={isRecording || !hasRecordedFrames}
              >
                <Trash2 className="w-5 h-5" />
                Reset Frames
              </Button>
              <Button
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                className="gap-2"
                onClick={
                  isRecording ? handleStopRecording : handleStartRecording
                }
              >
                {isRecording ? (
                  <>
                    <Square className="w-5 h-5" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Record className="w-5 h-5" />
                    Start Recording
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={handleNextEpisode}
                disabled={isRecording}
              >
                <PlusCircle className="w-5 h-5" />
                Next Episode
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="border border-white/10 rounded-md overflow-hidden">
          <TeleoperatorEpisodesView teleoperatorData={recorderRef.current?.teleoperatorData} />
        </div>

        {/* Camera Configuration */}
        <div className="border-t border-white/10 pt-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Camera Setup</h3>
            <Button
              onClick={() => setShowCameraConfig(!showCameraConfig)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Camera className="w-4 h-4" />
              {showCameraConfig ? "Hide Camera Config" : "Configure Cameras"}
            </Button>
          </div>

          {showCameraConfig && (
            <div className="bg-black/40 border border-white/20 rounded-lg p-6 mb-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Camera Preview & Selection */}
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-white/90">
                    Camera Preview
                  </h4>

                  {/* Camera Preview */}
                  <div className="aspect-video bg-black/60 border border-white/20 rounded-lg overflow-hidden">
                    {previewStream ? (
                      <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/60">
                        <div className="text-center">
                          <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          {isLoadingCameras ? (
                            <p>Loading cameras...</p>
                          ) : cameraPermissionState === "denied" ? (
                            <div>
                              <p>Camera access denied</p>
                              <p className="text-xs mt-1">
                                Please allow camera access and refresh
                              </p>
                            </div>
                          ) : availableCameras.length === 0 ? (
                            <p>Click "Load Cameras" to start</p>
                          ) : (
                            <p>Select a camera to preview</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera Controls */}
                  <div className="space-y-3">
                    <Button
                      onClick={() => loadAvailableCameras(false)}
                      variant="outline"
                      className="w-full gap-2"
                      disabled={hasRecordedFrames || isLoadingCameras}
                    >
                      <Camera className="w-4 h-4" />
                      {isLoadingCameras
                        ? "Loading..."
                        : availableCameras.length > 0
                        ? "Refresh Cameras"
                        : "Load Cameras"}
                    </Button>

                    {availableCameras.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm text-white/70">
                          Select Camera:
                        </label>
                        <Select
                          value={selectedCameraId}
                          onValueChange={switchCameraPreview}
                          disabled={hasRecordedFrames}
                        >
                          <SelectTrigger className="w-full bg-black/20 border-white/10">
                            <SelectValue placeholder="Choose a camera" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableCameras.map((camera) => (
                              <SelectItem
                                key={camera.deviceId}
                                value={camera.deviceId}
                              >
                                {camera.label ||
                                  `Camera ${camera.deviceId.slice(0, 8)}...`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Camera Naming & Adding */}
                <div className="space-y-4">
                  <h4 className="text-md font-semibold text-white/90">
                    Add to Recorder
                  </h4>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-white/70">
                        Camera Name:
                      </label>
                      <Input
                        placeholder="e.g., 'Overhead View', 'Side Angle', 'Close-up'"
                        value={cameraName}
                        onChange={(e) => setCameraName(e.target.value)}
                        className="bg-black/20 border-white/10"
                        disabled={hasRecordedFrames}
                      />
                      <p className="text-xs text-white/50">
                        Give this camera a descriptive name for your recording
                        setup
                      </p>
                    </div>

                    <Button
                      onClick={handleAddCamera}
                      className="w-full gap-2"
                      disabled={
                        hasRecordedFrames ||
                        !cameraName.trim() ||
                        !selectedCameraId ||
                        !previewStream
                      }
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Camera to Recorder
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Display added cameras */}
          {Object.keys(additionalCameras).length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-sm text-muted-foreground">Added Cameras:</p>
              <div className="flex flex-wrap gap-2">
                {Object.keys(additionalCameras).map((name) => (
                  <Badge
                    key={name}
                    variant="secondary"
                    className="flex items-center gap-1 py-1 px-2"
                  >
                    {name}
                    <button
                      onClick={() => handleRemoveCamera(name)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      disabled={hasRecordedFrames}
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleDownloadZip}
              disabled={recorderRef.current?.teleoperatorData.length === 0 || isRecording}
            >
              <Download className="w-4 h-4" />
              Download as ZIP
            </Button>

            {/* Reset Frames button moved to top bar */}
          </div>

          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleUploadToHuggingFace}
              disabled={
                recorderRef.current?.teleoperatorData.length === 0 || isRecording || !huggingfaceApiKey
              }
            >
              <Upload className="w-4 h-4" />
              Upload to HuggingFace
            </Button>

            <Input
              placeholder="HuggingFace API Key"
              value={huggingfaceApiKey}
              onChange={(e) => setHuggingfaceApiKey(e.target.value)}
              className="flex-1 bg-black/20 border-white/10"
              type="password"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

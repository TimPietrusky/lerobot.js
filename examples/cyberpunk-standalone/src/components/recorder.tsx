"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
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
  Settings,
  RefreshCw,
  X,
  Edit2,
  Check,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LeRobotDatasetRecorder, LeRobotEpisode } from "@lerobot/web";
import { TeleoperatorEpisodesView } from "./teleoperator-episodes-view";

interface RecorderProps {
  teleoperators: any[];
  robot: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  onNeedsTeleoperation: () => Promise<boolean>;
  showConfigure: boolean;
  onRecorderReady?: (callbacks: {
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    isRecording: boolean;
  }) => void;
  videoStreams?: { [key: string]: MediaStream };
}

interface RecorderSettings {
  huggingfaceApiKey: string;
  cameraConfigs: {
    [cameraName: string]: {
      deviceId: string;
      deviceLabel: string;
    };
  };
}

// Storage functions for recorder settings
const RECORDER_SETTINGS_KEY = "lerobot-recorder-settings";

function getRecorderSettings(): RecorderSettings {
  try {
    const stored = localStorage.getItem(RECORDER_SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn("Failed to load recorder settings:", error);
  }
  return {
    huggingfaceApiKey: "",
    cameraConfigs: {},
  };
}

function saveRecorderSettings(settings: RecorderSettings): void {
  try {
    localStorage.setItem(RECORDER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("Failed to save recorder settings:", error);
  }
}

export function Recorder({
  teleoperators,
  robot,
  onNeedsTeleoperation,
  showConfigure,
  onRecorderReady,
}: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [persistedEpisodes, setPersistedEpisodes] = useState<any[]>([]);
  const [uiTick, setUiTick] = useState(0);
  const [showDeleteEpisodesDialog, setShowDeleteEpisodesDialog] =
    useState(false);
  // Use huggingfaceApiKey from recorderSettings instead of separate state
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

  const [recorderSettings, setRecorderSettings] = useState<RecorderSettings>(
    () => getRecorderSettings()
  );
  const [hasRecordedFrames, setHasRecordedFrames] = useState(false);
  const [editingCameraName, setEditingCameraName] = useState<string | null>(
    null
  );
  const [editingCameraNewName, setEditingCameraNewName] = useState("");
  const [sourceSelectorOpenFor, setSourceSelectorOpenFor] = useState<
    string | null
  >(null);

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

      // Restore persisted episodes to the new recorder
      if (persistedEpisodes.length > 0) {
        (recorderRef.current as any).teleoperatorData = [...persistedEpisodes];
        setCurrentEpisode(persistedEpisodes.length - 1);
      }
    } else {
      // Persist episodes before clearing recorder
      if (recorderRef.current?.teleoperatorData) {
        setPersistedEpisodes((prev) => {
          // Only update if we have new data
          const currentData = recorderRef.current?.teleoperatorData || [];
          return currentData.length > 0 ? [...currentData] : prev;
        });
      }
      // Clear recorder when no teleoperators available
      recorderRef.current = null;
    }
  }, [teleoperators, additionalCameras, persistedEpisodes]);

  // Notify parent of recorder state changes
  useEffect(() => {
    if (onRecorderReady) {
      onRecorderReady({
        startRecording: handleStartRecordingClick,
        stopRecording: handleStopRecording,
        isRecording: isRecording,
      });
    }
  }, [isRecording, onRecorderReady]);

  // Simple recording start - just like the original working version
  const handleStartRecordingClick = async () => {
    if (!recorderRef.current) {
      toast({
        title: "Recording Error",
        description: "Recorder not ready yet. Please enable control first.",
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

      // Persist episodes when stopping recording
      setPersistedEpisodes([...recorderRef.current.teleoperatorData]);

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

  const handleDeleteEpisodes = async () => {
    if (recorderRef.current) {
      recorderRef.current.clearRecording();

      // If currently recording, create a new episode so recording can continue
      if (isRecording) {
        (recorderRef.current as any).teleoperatorData.push(
          new LeRobotEpisode()
        );
        console.log(
          "Created new episode after delete, teleoperatorData:",
          recorderRef.current.teleoperatorData
        );
      }
    }

    // Clear persisted episodes only if not recording
    if (!isRecording) {
      setPersistedEpisodes([]);
    }

    setCurrentEpisode(0);
    setHasRecordedFrames(isRecording); // Keep true if recording, false if not
    setShowDeleteEpisodesDialog(false);

    toast({
      title: "Episodes Deleted",
      description: isRecording
        ? "All recorded episodes have been cleared. Recording continues with new episode 0."
        : "All recorded episodes have been cleared.",
    });
  };

  const handleNextEpisode = () => {
    if (!isRecording || !recorderRef.current) {
      return;
    }

    // Finish current episode and start next one (within the same recording session)
    // Increment episode counter
    const nextEpisode = currentEpisode + 1;
    setCurrentEpisode(nextEpisode);

    // Set the new episode index on the recorder
    recorderRef.current.setEpisodeIndex(nextEpisode);

    // Create a new episode in the teleoperatorData array
    // This is needed because currentEpisode always points to the last episode
    (recorderRef.current as any).teleoperatorData.push(new LeRobotEpisode());

    console.log(
      "After next episode - teleoperatorData:",
      recorderRef.current.teleoperatorData
    );
    console.log(
      "After next episode - teleoperatorData.length:",
      recorderRef.current.teleoperatorData.length
    );

    toast({
      title: "Next Episode Started",
      description: `Now recording episode ${nextEpisode}`,
    });
  };

  // Force lightweight UI refresh while recording so episode table updates in near real-time
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => {
      setUiTick((t) => (t + 1) % 1_000_000);
    }, 500);
    return () => clearInterval(id);
  }, [isRecording]);

  // (Removed) Reset frames button in favor of Delete Episodes with confirmation

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
        let finalVideoDevices = videoDevices;

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
          finalVideoDevices = videoDevicesWithLabels;
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
        if (finalVideoDevices.length > 0 && !selectedCameraId) {
          const firstCameraId = finalVideoDevices[0].deviceId;

          // Stop temp stream since we'll create a fresh one with switchCameraPreview
          if (tempStream) {
            tempStream.getTracks().forEach((track) => track.stop());
          }

          setCameraPermissionState("granted");

          // Use the same logic as manual camera switching
          await switchCameraPreview(firstCameraId);
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

  // Change camera source for an already-added camera card
  const handleChangeCameraSourceForCard = useCallback(
    async (cameraName: string, deviceId: string) => {
      if (hasRecordedFrames) {
        toast({
          title: "Camera Error",
          description:
            "Cannot change camera source after recording has started",
          variant: "destructive",
        });
        return;
      }

      try {
        // Create new stream for selected device
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        // Replace existing stream in additionalCameras
        setAdditionalCameras((prev) => {
          const next = { ...prev };
          const old = next[cameraName];
          if (old) {
            old.getTracks().forEach((t) => t.stop());
          }
          next[cameraName] = newStream;
          return next;
        });

        // Update persistent config
        const selected = availableCameras.find((c) => c.deviceId === deviceId);
        const newSettings = {
          ...recorderSettings,
          cameraConfigs: { ...recorderSettings.cameraConfigs },
        };
        if (!newSettings.cameraConfigs[cameraName]) {
          newSettings.cameraConfigs[cameraName] = {
            deviceId,
            deviceLabel: selected?.label || `Camera ${deviceId.slice(0, 8)}...`,
          };
        } else {
          newSettings.cameraConfigs[cameraName].deviceId = deviceId;
          newSettings.cameraConfigs[cameraName].deviceLabel =
            selected?.label || `Camera ${deviceId.slice(0, 8)}...`;
        }
        setRecorderSettings(newSettings);
        saveRecorderSettings(newSettings);

        setSourceSelectorOpenFor(null);
        toast({
          title: "Camera Source Updated",
          description: `\"${cameraName}\" now uses \"${
            selected?.label || deviceId
          }\"`,
        });
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
    [hasRecordedFrames, availableCameras, recorderSettings, toast]
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

      // Save camera configuration to persistent storage
      const selectedCamera = availableCameras.find(
        (cam) => cam.deviceId === selectedCameraId
      );
      const newSettings = {
        ...recorderSettings,
        cameraConfigs: {
          ...recorderSettings.cameraConfigs,
          [cameraName]: {
            deviceId: selectedCameraId,
            deviceLabel:
              selectedCamera?.label ||
              `Camera ${selectedCameraId.slice(0, 8)}...`,
          },
        },
      };
      setRecorderSettings(newSettings);
      saveRecorderSettings(newSettings);

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
  }, [
    cameraName,
    hasRecordedFrames,
    selectedCameraId,
    previewStream,
    availableCameras,
    recorderSettings,
    toast,
  ]);

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

      // Remove camera configuration from persistent storage
      const newSettings = {
        ...recorderSettings,
        cameraConfigs: { ...recorderSettings.cameraConfigs },
      };
      delete newSettings.cameraConfigs[name];
      setRecorderSettings(newSettings);
      saveRecorderSettings(newSettings);

      toast({
        title: "Camera Removed",
        description: `Camera "${name}" has been removed`,
      });
    },
    [hasRecordedFrames, recorderSettings, toast]
  );

  // Camera name editing functions
  const handleStartEditingCameraName = (cameraName: string) => {
    setEditingCameraName(cameraName);
    setEditingCameraNewName(cameraName);
  };

  const handleConfirmCameraNameEdit = (oldName: string) => {
    if (editingCameraNewName.trim() && editingCameraNewName !== oldName) {
      const stream = additionalCameras[oldName];
      if (stream) {
        // Update camera streams
        setAdditionalCameras((prev) => {
          const newCameras = { ...prev };
          delete newCameras[oldName];
          newCameras[editingCameraNewName.trim()] = stream;
          return newCameras;
        });

        // Update camera configuration in persistent storage
        const oldConfig = recorderSettings.cameraConfigs[oldName];
        if (oldConfig) {
          const newSettings = {
            ...recorderSettings,
            cameraConfigs: { ...recorderSettings.cameraConfigs },
          };
          delete newSettings.cameraConfigs[oldName];
          newSettings.cameraConfigs[editingCameraNewName.trim()] = oldConfig;
          setRecorderSettings(newSettings);
          saveRecorderSettings(newSettings);
        }
      }
    }
    setEditingCameraName(null);
    setEditingCameraNewName("");
  };

  const handleCancelCameraNameEdit = () => {
    setEditingCameraName(null);
    setEditingCameraNewName("");
  };

  // Restore cameras from saved configurations
  const restoreSavedCameras = useCallback(async () => {
    const savedConfigs = recorderSettings.cameraConfigs;
    if (!savedConfigs || Object.keys(savedConfigs).length === 0) {
      return;
    }

    for (const [cameraName, config] of Object.entries(savedConfigs)) {
      try {
        // Check if this camera is still available
        const isDeviceAvailable = availableCameras.some(
          (cam) => cam.deviceId === config.deviceId
        );

        if (!isDeviceAvailable) {
          console.warn(
            `Saved camera "${cameraName}" (${config.deviceId}) is no longer available`
          );
          continue;
        }

        // Create stream for this saved camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: config.deviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        // Add to additional cameras
        setAdditionalCameras((prev) => ({
          ...prev,
          [cameraName]: stream,
        }));
      } catch (error) {
        console.error(`Failed to restore camera "${cameraName}":`, error);
        // Remove invalid configuration
        const newSettings = {
          ...recorderSettings,
          cameraConfigs: { ...recorderSettings.cameraConfigs },
        };
        delete newSettings.cameraConfigs[cameraName];
        setRecorderSettings(newSettings);
        saveRecorderSettings(newSettings);
      }
    }
  }, [availableCameras, recorderSettings]);

  // Auto-load cameras on component mount (only once)
  useEffect(() => {
    loadAvailableCameras(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once

  // Handle video stream assignment - runs when stream changes OR when settings panel opens
  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream, showConfigure]); // Also depend on showConfigure so it re-runs when video element appears

  // Cleanup preview stream on unmount
  useEffect(() => {
    return () => {
      if (previewStream) {
        previewStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [previewStream]);

  // Restore saved cameras when available cameras are loaded
  useEffect(() => {
    if (availableCameras.length > 0 && cameraPermissionState === "granted") {
      restoreSavedCameras();
    }
  }, [availableCameras, cameraPermissionState, restoreSavedCameras]);

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

    if (!recorderSettings.huggingfaceApiKey) {
      toast({
        title: "Upload Error",
        description: "Please enter your Hugging Face API key in Configure",
        variant: "destructive",
      });
      return;
    }

    try {
      toast({
        title: "Upload Started",
        description: "Uploading dataset to Hugging Face...",
      });

      // Generate a unique repository name
      const repoName = `lerobot-recording-${Date.now()}`;

      const uploader = await recorderRef.current.exportForLeRobot(
        "huggingface",
        {
          repoName,
          accessToken: recorderSettings.huggingfaceApiKey,
        }
      );

      uploader.addEventListener("progress", (event: Event) => {
        console.log(event);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to upload to Hugging Face";
      toast({
        title: "Upload Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Recorder Settings - Toggleable Inline */}
      {showConfigure && (
        <div className="space-y-6">
          {/* Hugging Face Settings */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-foreground">Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Hugging Face API Key
                </label>
                <Input
                  placeholder="Enter your Hugging Face API key"
                  value={recorderSettings.huggingfaceApiKey}
                  onChange={(e) => {
                    const newSettings = {
                      ...recorderSettings,
                      huggingfaceApiKey: e.target.value,
                    };
                    setRecorderSettings(newSettings);
                    saveRecorderSettings(newSettings);
                  }}
                  type="password"
                  className="bg-black/20 border-white/10"
                />
                <p className="text-xs text-white/50">
                  Required to upload datasets to Hugging Face Hub
                </p>
              </div>
            </div>
          </div>

          {/* Camera Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              Camera Setup
            </h3>
            <div className="bg-black/40 border border-white/20 p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Camera Selection & Adding */}
                <div className="space-y-4">
                  {/* Camera Selection and Refresh */}

                  {/* Camera Access Request */}
                  {cameraPermissionState === "unknown" && (
                    <div className="space-y-3">
                      <div className="bg-black/60 border border-white/20 rounded-lg p-4 text-center">
                        <Camera className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm text-white/70 mb-3">
                          Camera access needed to configure cameras
                        </p>
                        <Button
                          onClick={() => loadAvailableCameras(false)}
                          variant="outline"
                          className="gap-2"
                          disabled={isLoadingCameras}
                        >
                          <Camera className="w-4 h-4" />
                          {isLoadingCameras
                            ? "Loading..."
                            : "Request Camera Access"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Camera Access Denied */}
                  {cameraPermissionState === "denied" && (
                    <div className="space-y-3">
                      <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4 text-center">
                        <Camera className="w-8 h-8 mx-auto mb-2 opacity-50 text-red-400" />
                        <p className="text-sm text-red-300 mb-1">
                          Camera access denied
                        </p>
                        <p className="text-xs text-red-400">
                          Please allow camera access in your browser settings
                          and refresh
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Camera List with Refresh Button */}
                  {cameraPermissionState === "granted" &&
                    availableCameras.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm text-white/70">
                          Select Camera:
                        </label>
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedCameraId}
                            onValueChange={switchCameraPreview}
                            disabled={hasRecordedFrames}
                          >
                            <SelectTrigger className="flex-1 bg-black/20 border-white/10">
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
                          <Button
                            onClick={() => loadAvailableCameras(false)}
                            variant="ghost"
                            size="sm"
                            className="gap-2 text-white/70 hover:text-white"
                            disabled={isLoadingCameras}
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${
                                isLoadingCameras ? "animate-spin" : ""
                              }`}
                            />
                            Refresh
                          </Button>
                        </div>
                      </div>
                    )}

                  {/* Camera Name Input */}
                  {selectedCameraId && (
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
                  )}

                  {/* Add Camera Button */}
                  {selectedCameraId && (
                    <div className="flex justify-end">
                      <Button
                        onClick={handleAddCamera}
                        className="gap-2"
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
                  )}
                </div>

                {/* Right Column: Camera Preview */}
                <div className="space-y-4">
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
                          {cameraPermissionState === "unknown" ? (
                            <p className="text-sm">
                              Request camera access to preview
                            </p>
                          ) : cameraPermissionState === "denied" ? (
                            <p className="text-sm">Camera access denied</p>
                          ) : availableCameras.length === 0 ? (
                            <p className="text-sm">No cameras available</p>
                          ) : !selectedCameraId ? (
                            <p className="text-sm">
                              Select a camera to preview
                            </p>
                          ) : (
                            <p className="text-sm">Loading preview...</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Added Camera Previews */}
      {Object.keys(additionalCameras).length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">
            Active Cameras
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(additionalCameras).map(([cameraName, stream]) => (
              <div
                key={cameraName}
                className="bg-black/40 border border-white/20 rounded-lg p-3 space-y-2"
              >
                <div className="aspect-video bg-black/60 border border-white/10 rounded overflow-hidden">
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    ref={(video) => {
                      if (video && stream) {
                        const current = video.srcObject as MediaStream | null;
                        if (current !== stream) {
                          video.srcObject = stream;
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  {editingCameraName === cameraName ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editingCameraNewName}
                        onChange={(e) =>
                          setEditingCameraNewName(e.target.value)
                        }
                        className="text-xs h-6 bg-black/20 border-white/10"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleConfirmCameraNameEdit(cameraName);
                          } else if (e.key === "Escape") {
                            handleCancelCameraNameEdit();
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={() => handleConfirmCameraNameEdit(cameraName)}
                        className="text-green-400 hover:text-green-300 p-1"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleCancelCameraNameEdit}
                        className="text-red-400 hover:text-red-300 p-1"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartEditingCameraName(cameraName)}
                      className="text-sm font-medium text-white/90 truncate hover:text-white cursor-pointer flex items-center gap-1 flex-1"
                      disabled={hasRecordedFrames}
                    >
                      {cameraName}
                      <Edit2 className="w-3 h-3 opacity-50" />
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-2">
                    {/* Inline camera source selector trigger */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setSourceSelectorOpenFor((prev) =>
                            prev === cameraName ? null : cameraName
                          )
                        }
                        className="text-white/80 hover:text-white p-1"
                        disabled={hasRecordedFrames}
                        title="Change camera source"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                      {sourceSelectorOpenFor === cameraName && (
                        <div className="absolute right-0 mt-1 z-20 bg-black/90 border border-white/20 rounded p-2 w-64">
                          <label className="text-xs text-white/70">
                            Camera Source
                          </label>
                          <Select
                            value={
                              recorderSettings.cameraConfigs[cameraName]
                                ?.deviceId || ""
                            }
                            onValueChange={(deviceId) =>
                              handleChangeCameraSourceForCard(
                                cameraName,
                                deviceId
                              )
                            }
                            disabled={hasRecordedFrames}
                          >
                            <SelectTrigger className="w-full h-8 bg-black/20 border-white/10">
                              <SelectValue placeholder="Choose a camera" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCameras.map((cam) => (
                                <SelectItem
                                  key={cam.deviceId}
                                  value={cam.deviceId}
                                >
                                  {cam.label ||
                                    `Camera ${cam.deviceId.slice(0, 8)}...`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveCamera(cameraName)}
                      className="text-red-400 hover:text-red-300 p-1"
                      disabled={hasRecordedFrames}
                      title="Remove camera"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episode Management & Dataset Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleNextEpisode}
            disabled={!isRecording}
          >
            <PlusCircle className="w-4 h-4" />
            Next Episode
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setShowDeleteEpisodesDialog(true)}
            disabled={
              persistedEpisodes.length === 0 &&
              (recorderRef.current?.teleoperatorData.length || 0) === 0
            }
          >
            <Trash2 className="w-4 h-4" />
            Delete Episodes
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleDownloadZip}
            disabled={
              recorderRef.current?.teleoperatorData.length === 0 || isRecording
            }
          >
            <Download className="w-4 h-4" />
            Download as ZIP
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleUploadToHuggingFace}
            disabled={
              recorderRef.current?.teleoperatorData.length === 0 ||
              isRecording ||
              !recorderSettings.huggingfaceApiKey
            }
          >
            <Upload className="w-4 h-4" />
            Upload to Hugging Face
          </Button>
        </div>
      </div>

      <div className="border border-white/10 rounded-md overflow-hidden">
        <TeleoperatorEpisodesView
          teleoperatorData={
            (uiTick, recorderRef.current?.teleoperatorData || persistedEpisodes)
          }
          isRecording={isRecording}
          refreshTick={uiTick}
        />
      </div>

      {/* Delete Episodes Confirmation Dialog */}
      <AlertDialog
        open={showDeleteEpisodesDialog}
        onOpenChange={setShowDeleteEpisodesDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Episodes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all recorded episodes? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEpisodes}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Episodes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export const MemoRecorder = memo(Recorder);

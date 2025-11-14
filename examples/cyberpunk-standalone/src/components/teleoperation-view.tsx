"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Power,
  PowerOff,
  Keyboard,
  Box,
  Camera,
  AlertCircle,
  Settings,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useCameraStream } from "@/hooks/use_camera_stream";
import {
  teleoperate,
  type TeleoperationProcess,
  type TeleoperationState,
  type TeleoperateConfig,
  type RobotConnection,
} from "@lerobot/web";
import { getUnifiedRobotData } from "@/lib/unified-storage";
import VirtualKey from "@/components/VirtualKey";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";
import { renderHandKeypoints } from "@lerobot/web";

interface TeleoperationViewProps {
  robot: RobotConnection;
}

type TeleoperatorType = "keyboard / direct" | "hand-tracking";

interface HandTrackingSettings {
  cameraToControlScale: number;
  positionSmoothing: number;
  pinchThreshold: number;
}

const DEFAULT_HAND_TRACKING_SETTINGS: HandTrackingSettings = {
  cameraToControlScale: 0.7,
  positionSmoothing: 0.3,
  pinchThreshold: 50,
};

// Keyboard controls for SO-100 (from conventions)
const SO100_KEYBOARD_CONTROLS = {
  shoulder_pan: { positive: "ArrowRight", negative: "ArrowLeft" },
  shoulder_lift: { positive: "ArrowUp", negative: "ArrowDown" },
  elbow_flex: { positive: "w", negative: "s" },
  wrist_flex: { positive: "a", negative: "d" },
  wrist_roll: { positive: "q", negative: "e" },
  gripper: { positive: "o", negative: "c" },
  stop: "Escape",
};

// Default motor configurations for immediate display
const DEFAULT_MOTOR_CONFIGS = [
  {
    name: "shoulder_pan",
    currentPosition: 2048,
    minPosition: 0,
    maxPosition: 4095,
  },
  {
    name: "shoulder_lift",
    currentPosition: 2048,
    minPosition: 0,
    maxPosition: 4095,
  },
  {
    name: "elbow_flex",
    currentPosition: 2048,
    minPosition: 0,
    maxPosition: 4095,
  },
  {
    name: "wrist_flex",
    currentPosition: 2048,
    minPosition: 0,
    maxPosition: 4095,
  },
  {
    name: "wrist_roll",
    currentPosition: 2048,
    minPosition: 0,
    maxPosition: 4095,
  },
  { name: "gripper", currentPosition: 2048, minPosition: 0, maxPosition: 4095 },
];

export function TeleoperationView({ robot }: TeleoperationViewProps) {
  const [teleopState, setTeleopState] = useState<TeleoperationState>({
    isActive: false,
    motorConfigs: [],
    lastUpdate: 0,
    keyStates: {},
  });

  const [selectedTeleopType, setSelectedTeleopType] =
    useState<TeleoperatorType>("keyboard / direct");
  const [handTrackingSettings, setHandTrackingSettings] =
    useState<HandTrackingSettings>(DEFAULT_HAND_TRACKING_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  // Local slider positions for immediate UI feedback with timestamps
  const [localMotorPositions, setLocalMotorPositions] = useState<{
    [motorName: string]: { position: number; timestamp: number };
  }>({});
  const keyboardProcessRef = useRef<TeleoperationProcess | null>(null);
  const directProcessRef = useRef<TeleoperationProcess | null>(null);
  const handTrackingProcessRef = useRef<TeleoperationProcess | null>(null);
  const { toast } = useToast();
  const {
    stream: cameraStream,
    error: cameraError,
    requestCamera,
    stopCamera,
    isLoading: isCameraLoading,
  } = useCameraStream();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load calibration data from unified storage
  const calibrationData = useMemo(() => {
    if (!robot.serialNumber) return undefined;

    const data = getUnifiedRobotData(robot.serialNumber);
    if (data?.calibration) {
      return data.calibration;
    }

    // Return undefined if no calibration data - let library handle defaults
    return undefined;
  }, [robot.serialNumber]);

  // Lazy initialization function - only connects when user wants to start
  const initializeTeleoperation = useCallback(async () => {
    if (!robot || !robot.robotType) {
      return false;
    }

    try {
      // Create keyboard / direct teleoperation process
      const keyboardConfig: TeleoperateConfig = {
        robot: robot,
        teleop: {
          type: "keyboard",
        },
        calibrationData,
        onStateUpdate: (state: TeleoperationState) => {
          setTeleopState(state);
        },
      };
      const keyboardProcess = await teleoperate(keyboardConfig);

      // Create direct teleoperation process
      const directConfig: TeleoperateConfig = {
        robot: robot,
        teleop: {
          type: "direct",
        },
        calibrationData,
        onStateUpdate: (state: TeleoperationState) => {
          setTeleopState(state);
        },
      };
      const directProcess = await teleoperate(directConfig);

      keyboardProcessRef.current = keyboardProcess;
      directProcessRef.current = directProcess;
      setTeleopState(directProcess.getState());

      // Initialize local motor positions from hardware state
      const initialState = directProcess.getState();
      const initialPositions: {
        [motorName: string]: { position: number; timestamp: number };
      } = {};
      initialState.motorConfigs.forEach((motor) => {
        initialPositions[motor.name] = {
          position: motor.currentPosition,
          timestamp: Date.now(),
        };
      });
      setLocalMotorPositions(initialPositions);

      setIsInitialized(true);

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize teleoperation";
      toast({
        title: "Teleoperation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [robot, robot.robotType, calibrationData, toast]);

  // Initialize hand tracking when camera stream becomes available
  useEffect(() => {
    const initializeHandTracking = async () => {
      if (
        selectedTeleopType === "hand-tracking" &&
        cameraStream &&
        videoRef.current
      ) {
        try {
          videoRef.current.srcObject = cameraStream;

          const handTrackingConfig: TeleoperateConfig = {
            robot: robot,
            teleop: {
              type: "hand-tracking",
              videoElement: videoRef.current,
              mediaStream: cameraStream,
              handTrackingConfig: {
                cameraToControlScale: handTrackingSettings.cameraToControlScale,
                zRangeMin: 0.4,
                zRangeMax: 2.4,
                positionSmoothing: handTrackingSettings.positionSmoothing,
                pinchThreshold: handTrackingSettings.pinchThreshold,
              },
            },
            calibrationData,
            onStateUpdate: (state: TeleoperationState) => {
              setTeleopState(state);
              if (canvasRef.current && (state as any).handKeypoints) {
                // Set canvas size to match video element
                const video = videoRef.current;
                if (video && video.videoWidth && video.videoHeight) {
                  canvasRef.current.width = video.videoWidth;
                  canvasRef.current.height = video.videoHeight;
                }
                renderHandKeypoints(
                  canvasRef.current,
                  (state as any).handKeypoints
                );
              }
            },
          };

          const handTrackingProcess = await teleoperate(handTrackingConfig);
          handTrackingProcessRef.current = handTrackingProcess;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to initialize hand tracking";
          toast({
            title: "Hand Tracking Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    };

    initializeHandTracking();
  }, [
    selectedTeleopType,
    cameraStream,
    handTrackingSettings,
    calibrationData,
    robot,
    toast,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const cleanup = async () => {
        try {
          if (keyboardProcessRef.current) {
            await keyboardProcessRef.current.disconnect();
            keyboardProcessRef.current = null;
          }
          if (directProcessRef.current) {
            await directProcessRef.current.disconnect();
            directProcessRef.current = null;
          }
          if (handTrackingProcessRef.current) {
            await handTrackingProcessRef.current.disconnect();
            handTrackingProcessRef.current = null;
          }
          stopCamera();
        } catch (error) {
          console.warn("Error during teleoperation cleanup:", error);
        }
      };
      cleanup();
    };
  }, [stopCamera]);

  // Keyboard event handlers (guarded to not interfere with inputs/shortcuts)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!teleopState.isActive || !keyboardProcessRef.current) return;

      // Ignore when user is typing in inputs/textareas or contenteditable elements
      const target = event.target as HTMLElement | null;
      const isEditableTarget = !!(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest(
            '[role="textbox"], [contenteditable="true"], input, textarea, select'
          ))
      );
      if (isEditableTarget) return;

      // Allow browser/system shortcuts (e.g. Ctrl/Cmd+R, Ctrl/Cmd+L, etc.)
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Only handle specific teleop keys
      const rawKey = event.key;
      const normalizedKey = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
      const allowedKeys = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
        "q",
        "e",
        "o",
        "c",
        "Escape",
      ]);
      if (!allowedKeys.has(normalizedKey)) return;

      event.preventDefault();

      const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
      if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
        (
          keyboardTeleoperator as {
            updateKeyState: (key: string, pressed: boolean) => void;
          }
        ).updateKeyState(normalizedKey, true);
      }
    },
    [teleopState.isActive]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!teleopState.isActive || !keyboardProcessRef.current) return;

      // Ignore when user is typing in inputs/textareas or contenteditable elements
      const target = event.target as HTMLElement | null;
      const isEditableTarget = !!(
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable ||
          target.closest(
            '[role="textbox"], [contenteditable="true"], input, textarea, select'
          ))
      );
      if (isEditableTarget) return;

      // Allow browser/system shortcuts (e.g. Ctrl/Cmd+R, Ctrl/Cmd+L, etc.)
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Only handle specific teleop keys
      const rawKey = event.key;
      const normalizedKey = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey;
      const allowedKeys = new Set([
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "w",
        "a",
        "s",
        "d",
        "q",
        "e",
        "o",
        "c",
        "Escape",
      ]);
      if (!allowedKeys.has(normalizedKey)) return;

      event.preventDefault();

      const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
      if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
        (
          keyboardTeleoperator as {
            updateKeyState: (key: string, pressed: boolean) => void;
          }
        ).updateKeyState(normalizedKey, false);
      }
    },
    [teleopState.isActive]
  );

  // Register keyboard events
  useEffect(() => {
    if (teleopState.isActive) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [teleopState.isActive, handleKeyDown, handleKeyUp]);

  const handleStart = async () => {
    // Initialize on first use if not already initialized
    if (!isInitialized) {
      const success = await initializeTeleoperation();
      if (!success) return;
    }

    // Request camera for hand tracking
    if (selectedTeleopType === "hand-tracking" && !cameraStream) {
      try {
        await requestCamera();
      } catch (error) {
        toast({
          title: "Camera Error",
          description: "Failed to access camera",
          variant: "destructive",
        });
        return;
      }
    }

    if (
      !(
        keyboardProcessRef.current ||
        directProcessRef.current ||
        handTrackingProcessRef.current
      )
    ) {
      toast({
        title: "Teleoperation Error",
        description: "Teleoperation not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      if (selectedTeleopType === "keyboard / direct") {
        keyboardProcessRef.current?.start();
        directProcessRef.current?.start();
      } else if (selectedTeleopType === "hand-tracking") {
        handTrackingProcessRef.current?.start();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to start teleoperation";
      toast({
        title: "Start Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleStop = async () => {
    try {
      if (selectedTeleopType === "keyboard / direct") {
        keyboardProcessRef.current?.stop();
        directProcessRef.current?.stop();
      } else if (selectedTeleopType === "hand-tracking") {
        handTrackingProcessRef.current?.stop();
      }
    } catch (error) {
      console.warn("Error during teleoperation stop:", error);
    }
  };

  const handleTeleopTypeChange = async (value: TeleoperatorType) => {
    handleStop();
    setSelectedTeleopType(value);

    // Request camera when hand-tracking is selected
    if (value === "hand-tracking" && !cameraStream) {
      try {
        await requestCamera();
      } catch (error) {
        toast({
          title: "Camera Error",
          description: "Failed to access camera",
          variant: "destructive",
        });
      }
    }
  };

  // Virtual keyboard functions
  const simulateKeyPress = (key: string) => {
    if (!keyboardProcessRef.current || !teleopState.isActive) return;

    const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
    if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
      (
        keyboardTeleoperator as {
          updateKeyState: (key: string, pressed: boolean) => void;
        }
      ).updateKeyState(key, true);
    }
  };

  const simulateKeyRelease = (key: string) => {
    if (!keyboardProcessRef.current || !teleopState.isActive) return;

    const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
    if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
      (
        keyboardTeleoperator as {
          updateKeyState: (key: string, pressed: boolean) => void;
        }
      ).updateKeyState(key, false);
    }
  };

  // Motor control through direct teleoperator
  const moveMotor = async (motorName: string, position: number) => {
    if (!directProcessRef.current) return;

    try {
      // Immediately update local UI state for responsive slider feedback
      setLocalMotorPositions((prev) => ({
        ...prev,
        [motorName]: { position, timestamp: Date.now() },
      }));

      const directTeleoperator = directProcessRef.current.teleoperator;
      if (directTeleoperator && "moveMotor" in directTeleoperator) {
        await (
          directTeleoperator as {
            moveMotor: (motorName: string, position: number) => Promise<void>;
          }
        ).moveMotor(motorName, position);
      }
    } catch (error) {
      console.warn(
        `Failed to move motor ${motorName} to position ${position}:`,
        error
      );
      toast({
        title: "Motor Control Error",
        description: `Failed to move ${motorName}`,
        variant: "destructive",
      });
    }
  };

  // Merge hardware state with local UI state for responsive sliders
  const motorConfigs = useMemo(() => {
    const realMotorConfigs = teleopState?.motorConfigs || [];
    const now = Date.now();

    // If we have real motor configs, use them with local position overrides when appropriate
    if (realMotorConfigs.length > 0) {
      return realMotorConfigs.map((motor) => {
        const localData = localMotorPositions[motor.name];

        // Use local position if it exists and either:
        // 1. It's very recent (within 500ms) OR
        // 2. The hardware position is not yet close to our requested position
        const isRecent = localData && now - localData.timestamp < 500;
        const isHardwareNotCaughtUp =
          localData && Math.abs(motor.currentPosition - localData.position) > 5;
        const useLocalPosition =
          localData && (isRecent || isHardwareNotCaughtUp);

        return {
          ...motor,
          currentPosition: useLocalPosition
            ? localData.position
            : motor.currentPosition,
        };
      });
    }

    // Otherwise, show default configs with calibration data if available
    return DEFAULT_MOTOR_CONFIGS.map((motor) => {
      const calibratedMotor = calibrationData?.[motor.name];
      const localData = localMotorPositions[motor.name];
      // Use local position if it exists and either:
      // 1. It's very recent (within 500ms) OR
      // 2. We don't have a hardware position yet that's close to our requested position
      const isRecent = localData && now - localData.timestamp < 500;
      const isHardwareNotCaughtUp =
        localData && Math.abs(motor.currentPosition - localData.position) > 5;
      const useLocalPosition = localData && (isRecent || isHardwareNotCaughtUp);

      return {
        ...motor,
        minPosition: calibratedMotor?.range_min ?? motor.minPosition,
        maxPosition: calibratedMotor?.range_max ?? motor.maxPosition,
        // Show 0 when inactive to look deactivated, local/real position when active
        currentPosition: teleopState?.isActive
          ? useLocalPosition
            ? localData.position
            : motor.currentPosition
          : 0,
      };
    });
  }, [
    teleopState?.motorConfigs,
    teleopState?.isActive,
    localMotorPositions,
    calibrationData,
  ]);

  const keyStates = teleopState?.keyStates || {};
  const controls = SO100_KEYBOARD_CONTROLS;

  const handleResetSettings = () => {
    setHandTrackingSettings(DEFAULT_HAND_TRACKING_SETTINGS);
    toast({
      title: "Settings Reset",
      description: "Hand tracking settings restored to defaults",
    });
  };

  return (
    <>
      <Card className="border-0 rounded-none">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-8 bg-primary"></div>
              <div>
                <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">
                  robot control
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  manual{" "}
                  <span className="text-muted-foreground">teleoperate</span>{" "}
                  interface
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="border-l border-white/10 pl-6 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground uppercase">
                    control type:
                  </span>
                  <Select
                    value={selectedTeleopType}
                    onValueChange={handleTeleopTypeChange}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyboard / direct">
                        Keyboard / Direct
                      </SelectItem>
                      <SelectItem value="hand-tracking">
                        Hand Tracking
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {teleopState?.isActive ? (
                  <Button onClick={handleStop} variant="destructive" size="lg">
                    <PowerOff className="w-5 h-5 mr-2" /> Stop Control
                  </Button>
                ) : (
                  <Button
                    onClick={handleStart}
                    size="lg"
                    disabled={!robot.isConnected}
                  >
                    <Power className="w-5 h-5 mr-2" /> Control Robot
                  </Button>
                )}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground uppercase">
                      robot:
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-primary/50 bg-primary/20 text-primary font-mono text-xs",
                        robot.isConnected
                          ? "border-green-500/50 bg-green-500/20 text-green-400"
                          : "border-red-500/50 bg-red-500/20 text-red-400"
                      )}
                    >
                      {robot.isConnected ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-muted-foreground uppercase">
                      control:
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-primary/50 bg-primary/20 text-primary font-mono text-xs",
                        teleopState?.isActive && "animate-pulse-slow"
                      )}
                    >
                      {teleopState?.isActive ? "ACTIVE" : "STOPPED"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {cameraError && selectedTeleopType === "hand-tracking" && (
          <Alert
            variant="destructive"
            className="rounded-none border-0 border-b border-white/10"
          >
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Camera Error: {cameraError.message}
            </AlertDescription>
          </Alert>
        )}

        {selectedTeleopType === "hand-tracking" && (
          <div className="p-6 border-b border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-sans font-semibold mb-4 text-xl">
                Hand Tracking
              </h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSettings(!showSettings)}
                      className="gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Adjust hand tracking parameters
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="relative bg-black/50 rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
              </div>
              <div className="space-y-4 overflow-y-auto max-h-[480px]">
                <div>
                  <p className="text-sm font-mono text-muted-foreground mb-2">
                    Camera Status
                  </p>
                  <div className="flex items-center gap-2">
                    {cameraStream ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-green-400 font-mono text-sm">
                          Camera Active
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="text-red-400 font-mono text-sm">
                          No Camera
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {(teleopState as any)?.detectedGestures && (
                  <div>
                    <p className="text-sm font-mono text-muted-foreground mb-2">
                      Active Gestures
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(teleopState as any).detectedGestures.map(
                        (gesture: string) => (
                          <Badge key={gesture} variant="secondary">
                            {gesture}
                          </Badge>
                        )
                      )}
                      {(teleopState as any)?.detectedGestures.length === 0 && (
                        <span className="text-muted-foreground text-sm font-mono">
                          None detected
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Gesture Guide - Always Open */}
                <div className="p-3 bg-black/30 rounded-lg border border-white/10 space-y-3">
                  <p
                    className="text-sm text-muted-foreground uppercase font-semibold"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    📖 Gesture Guide (Calibration Mode)
                  </p>
                  <div
                    className="text-xs space-y-2"
                    style={{ fontFamily: "'Geist Mono', monospace" }}
                  >
                    <div className="border-l-2 border-blue-400 pl-3">
                      <p className="font-semibold text-blue-400">
                        Hand Position X
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Move hand left/right → shoulder_pan
                      </p>
                    </div>
                    <div className="border-l-2 border-cyan-400 pl-3">
                      <p className="font-semibold text-cyan-400">
                        Hand Position Y
                      </p>
                      <p className="text-muted-foreground text-xs">
                        Move hand up/down → shoulder_lift
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Debug Info - Motor Positions */}
            {(teleopState as any)?.isActive && (
              <div className="mt-4 p-4 bg-black/40 rounded-lg border border-white/10 space-y-3">
                <p className="text-sm font-mono text-muted-foreground uppercase font-semibold">
                  Motor Debug Info
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {handTrackingProcessRef.current?.teleoperator &&
                    "getDebugInfo" in
                      handTrackingProcessRef.current.teleoperator &&
                    Object.entries(
                      (
                        handTrackingProcessRef.current.teleoperator as any
                      ).getDebugInfo()?.motorPositions || {}
                    ).map(([motorName, position]) => (
                      <div
                        key={motorName}
                        className="flex justify-between bg-black/30 px-2 py-1 rounded text-white/80"
                      >
                        <span className="text-blue-400">{motorName}:</span>
                        <span className="text-green-400">
                          {typeof position === "number"
                            ? position.toFixed(0)
                            : position}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Gesture Guide */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground mt-4 p-2">
                <span>📖</span>
                <span>Gesture Guide</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 p-4 bg-black/30 rounded-lg border border-white/10 space-y-3">
                <div className="text-xs space-y-3">
                  <div className="border-l-2 border-blue-400 pl-3">
                    <p className="font-semibold text-blue-400">
                      Hand Position (X/Y)
                    </p>
                    <p className="text-muted-foreground">
                      Move your hand horizontally and vertically to control the
                      robot arm's X and Y position in 2D space. The index finger
                      tip tracks this movement.
                    </p>
                  </div>
                  <div className="border-l-2 border-green-400 pl-3">
                    <p className="font-semibold text-green-400">
                      Pinch (Z-axis)
                    </p>
                    <p className="text-muted-foreground">
                      Pinch your thumb and index finger together to
                      extend/retract the arm's reach along the Z-axis. Closer
                      pinch = arm extends further out.
                    </p>
                  </div>
                  <div className="border-l-2 border-yellow-400 pl-3">
                    <p className="font-semibold text-yellow-400">
                      Gripper Control
                    </p>
                    <p className="text-muted-foreground">
                      Distance between thumb and index finger controls gripper
                      opening. Pinched = closed, fingers spread = open.
                    </p>
                  </div>
                  <div className="border-l-2 border-orange-400 pl-3">
                    <p className="font-semibold text-orange-400">
                      Wrist Rotation
                    </p>
                    <p className="text-muted-foreground">
                      Rotate your hand (twist your wrist) to rotate the gripper
                      left or right.
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {showSettings && (
              <div className="mt-6 p-4 bg-black/30 rounded-lg border border-white/10 space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono font-semibold text-sm uppercase tracking-wide">
                    Parameter Tuning
                  </h4>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleResetSettings}
                          className="gap-1 h-8"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Reset
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Restore default settings</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="space-y-4">
                  {/* Camera-to-Control Scale */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-mono text-muted-foreground">
                        Buffer Zone (Camera Scale)
                      </label>
                      <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded">
                        {handTrackingSettings.cameraToControlScale.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[handTrackingSettings.cameraToControlScale]}
                      min={0.5}
                      max={1.0}
                      step={0.05}
                      onValueChange={(val) =>
                        setHandTrackingSettings((prev) => ({
                          ...prev,
                          cameraToControlScale: val[0],
                        }))
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Lower = more buffer zone, prevents edge triggers
                    </p>
                  </div>

                  {/* Position Smoothing */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-mono text-muted-foreground">
                        Position Smoothing
                      </label>
                      <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded">
                        {handTrackingSettings.positionSmoothing.toFixed(2)}
                      </span>
                    </div>
                    <Slider
                      value={[handTrackingSettings.positionSmoothing]}
                      min={0.1}
                      max={0.5}
                      step={0.05}
                      onValueChange={(val) =>
                        setHandTrackingSettings((prev) => ({
                          ...prev,
                          positionSmoothing: val[0],
                        }))
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher = more smoothing, reduces jitter but adds lag
                    </p>
                  </div>

                  {/* Pinch Threshold */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-mono text-muted-foreground">
                        Pinch Threshold (pixels)
                      </label>
                      <span className="text-xs font-mono bg-black/50 px-2 py-1 rounded">
                        {handTrackingSettings.pinchThreshold}px
                      </span>
                    </div>
                    <Slider
                      value={[handTrackingSettings.pinchThreshold]}
                      min={30}
                      max={100}
                      step={5}
                      onValueChange={(val) =>
                        setHandTrackingSettings((prev) => ({
                          ...prev,
                          pinchThreshold: val[0],
                        }))
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Distance between thumb and index to trigger gripper
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-black/50 p-2 rounded">
                    <p className="text-muted-foreground">Default Buffer</p>
                    <p className="font-mono text-accent">0.70</p>
                  </div>
                  <div className="bg-black/50 p-2 rounded">
                    <p className="text-muted-foreground">Default Smooth</p>
                    <p className="font-mono text-accent">0.30</p>
                  </div>
                  <div className="bg-black/50 p-2 rounded">
                    <p className="text-muted-foreground">Default Pinch</p>
                    <p className="font-mono text-accent">50px</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="pt-6 p-6 grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-sans font-semibold mb-4 text-xl">
              Motor Control
            </h3>
            <div className="space-y-6">
              {motorConfigs.map((motor) => (
                <div key={motor.name}>
                  <label className="text-sm font-mono text-muted-foreground">
                    {motor.name}
                  </label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[motor.currentPosition]}
                      min={motor.minPosition}
                      max={motor.maxPosition}
                      step={1}
                      onValueChange={(val) => moveMotor(motor.name, val[0])}
                      disabled={!teleopState?.isActive}
                      className={!teleopState?.isActive ? "opacity-50" : ""}
                    />
                    <span
                      className={cn(
                        "text-lg font-mono w-16 text-right",
                        teleopState?.isActive
                          ? "text-accent"
                          : "text-muted-foreground"
                      )}
                    >
                      {Math.round(motor.currentPosition)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {selectedTeleopType !== "hand-tracking" && (
            <div>
              <h3 className="font-sans font-semibold mb-4 text-xl">
                Keyboard Layout & Status
              </h3>
              <div className="p-4 bg-black/30 rounded-lg space-y-4">
                <div className="flex justify-around items-end">
                  <div className="flex flex-col items-center gap-2">
                    <VirtualKey
                      label="↑"
                      subLabel="Lift+"
                      isPressed={
                        !!keyStates[controls.shoulder_lift.positive]?.pressed
                      }
                      onMouseDown={() =>
                        simulateKeyPress(controls.shoulder_lift.positive)
                      }
                      onMouseUp={() =>
                        simulateKeyRelease(controls.shoulder_lift.positive)
                      }
                      disabled={!teleopState?.isActive}
                    />
                    <div className="flex gap-2">
                      <VirtualKey
                        label="←"
                        subLabel="Pan-"
                        isPressed={
                          !!keyStates[controls.shoulder_pan.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.shoulder_pan.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.shoulder_pan.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="↓"
                        subLabel="Lift-"
                        isPressed={
                          !!keyStates[controls.shoulder_lift.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.shoulder_lift.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.shoulder_lift.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="→"
                        subLabel="Pan+"
                        isPressed={
                          !!keyStates[controls.shoulder_pan.positive]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.shoulder_pan.positive)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.shoulder_pan.positive)
                        }
                        disabled={!teleopState?.isActive}
                      />
                    </div>
                    <span className="font-bold text-sm font-sans">
                      Shoulder
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <VirtualKey
                      label="W"
                      subLabel="Elbow+"
                      isPressed={
                        !!keyStates[controls.elbow_flex.positive]?.pressed
                      }
                      onMouseDown={() =>
                        simulateKeyPress(controls.elbow_flex.positive)
                      }
                      onMouseUp={() =>
                        simulateKeyRelease(controls.elbow_flex.positive)
                      }
                      disabled={!teleopState?.isActive}
                    />
                    <div className="flex gap-2">
                      <VirtualKey
                        label="A"
                        subLabel="Wrist+"
                        isPressed={
                          !!keyStates[controls.wrist_flex.positive]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.wrist_flex.positive)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.wrist_flex.positive)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="S"
                        subLabel="Elbow-"
                        isPressed={
                          !!keyStates[controls.elbow_flex.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.elbow_flex.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.elbow_flex.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="D"
                        subLabel="Wrist-"
                        isPressed={
                          !!keyStates[controls.wrist_flex.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.wrist_flex.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.wrist_flex.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                    </div>
                    <span className="font-bold text-sm font-sans">
                      Elbow/Wrist
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex gap-2">
                      <VirtualKey
                        label="Q"
                        subLabel="Roll+"
                        isPressed={
                          !!keyStates[controls.wrist_roll.positive]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.wrist_roll.positive)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.wrist_roll.positive)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="E"
                        subLabel="Roll-"
                        isPressed={
                          !!keyStates[controls.wrist_roll.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.wrist_roll.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.wrist_roll.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                    </div>
                    <div className="flex gap-2">
                      <VirtualKey
                        label="O"
                        subLabel="Grip+"
                        isPressed={
                          !!keyStates[controls.gripper.positive]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.gripper.positive)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.gripper.positive)
                        }
                        disabled={!teleopState?.isActive}
                      />
                      <VirtualKey
                        label="C"
                        subLabel="Grip-"
                        isPressed={
                          !!keyStates[controls.gripper.negative]?.pressed
                        }
                        onMouseDown={() =>
                          simulateKeyPress(controls.gripper.negative)
                        }
                        onMouseUp={() =>
                          simulateKeyRelease(controls.gripper.negative)
                        }
                        disabled={!teleopState?.isActive}
                      />
                    </div>
                    <span className="font-bold text-sm font-sans">
                      Roll/Grip
                    </span>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center font-mono text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Keyboard className="w-4 h-4" />
                      <span>
                        Active Keys:{" "}
                        {
                          Object.values(keyStates).filter((k) => k.pressed)
                            .length
                        }
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              "w-10 h-6 border rounded-md flex items-center justify-center font-mono text-xs transition-all",
                              "select-none user-select-none",
                              !teleopState?.isActive &&
                                "opacity-50 cursor-not-allowed",
                              teleopState?.isActive &&
                                "cursor-pointer hover:bg-white/5",
                              keyStates[controls.stop]?.pressed
                                ? "bg-destructive text-destructive-foreground border-destructive"
                                : "bg-background"
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (teleopState?.isActive) {
                                simulateKeyPress(controls.stop);
                              }
                            }}
                            onMouseUp={(e) => {
                              e.preventDefault();
                              if (teleopState?.isActive) {
                                simulateKeyRelease(controls.stop);
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.preventDefault();
                              if (teleopState?.isActive) {
                                simulateKeyRelease(controls.stop);
                              }
                            }}
                          >
                            ESC
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>Emergency Stop</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

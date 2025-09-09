"use client";

import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  startTransition,
} from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Gamepad2,
  Keyboard,
  Settings,
  Square,
  Disc as Record,
  Check,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  teleoperate,
  type TeleoperationProcess,
  type TeleoperationState,
  type TeleoperateConfig,
  type RobotConnection,
} from "@lerobot/web";
import { getUnifiedRobotData } from "@/lib/unified-storage";
import { MemoRecorder as Recorder } from "@/components/recorder";

const UI_UPDATE_INTERVAL_MS = 100;

interface RecordingViewProps {
  robot: RobotConnection;
}

export function RecordingView({ robot }: RecordingViewProps) {
  const [teleopState, setTeleopState] = useState<TeleoperationState>({
    isActive: false,
    motorConfigs: [],
    lastUpdate: 0,
    keyStates: {},
  });

  const [isInitialized, setIsInitialized] = useState(false);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [selectedTeleoperatorType, setSelectedTeleoperatorType] = useState<
    "direct" | "keyboard"
  >("keyboard");
  const [showConfigure, setShowConfigure] = useState(false);
  const [recorderCallbacks, setRecorderCallbacks] = useState<{
    startRecording: () => Promise<void>;
    stopRecording: () => Promise<void>;
    isRecording: boolean;
  } | null>(null);

  // Current step tracking
  const currentStep = useMemo(() => {
    if (!robot.isConnected) return 0; // No steps active if robot offline
    if (!controlEnabled) return 1; // Step 1: Enable Control
    if (!recorderCallbacks?.isRecording) return 2; // Step 2: Start Recording
    return 3; // Step 3: Move Robot (recording active)
  }, [robot.isConnected, controlEnabled, recorderCallbacks?.isRecording]);
  const keyboardProcessRef = useRef<TeleoperationProcess | null>(null);
  const directProcessRef = useRef<TeleoperationProcess | null>(null);
  const lastUiUpdateRef = useRef(0);

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

  // Initialize teleoperation for recording
  const initializeTeleoperation = useCallback(async () => {
    if (!robot || !robot.robotType) {
      return false;
    }

    try {
      // Create keyboard teleoperation process
      const keyboardConfig: TeleoperateConfig = {
        robot: robot,
        teleop: {
          type: "keyboard",
        },
        calibrationData,
        onStateUpdate: (state: TeleoperationState) => {
          const now = performance.now();
          if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
            lastUiUpdateRef.current = now;
            startTransition(() => setTeleopState(state));
          }
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
          const now = performance.now();
          if (now - lastUiUpdateRef.current >= UI_UPDATE_INTERVAL_MS) {
            lastUiUpdateRef.current = now;
            startTransition(() => setTeleopState(state));
          }
        },
      };
      const directProcess = await teleoperate(directConfig);

      keyboardProcessRef.current = keyboardProcess;
      directProcessRef.current = directProcess;
      setTeleopState(directProcess.getState());

      setIsInitialized(true);

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to initialize teleoperation for recording";
      toast({
        title: "Teleoperation Error",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [robot, robot.robotType, calibrationData]);

  // Enable robot control for recording
  const enableControl = useCallback(async () => {
    if (!robot.isConnected) {
      return false;
    }

    const success = await initializeTeleoperation();
    if (success) {
      // Start the appropriate teleoperator based on selection
      if (
        selectedTeleoperatorType === "keyboard" &&
        keyboardProcessRef.current
      ) {
        keyboardProcessRef.current.start();
      } else if (
        selectedTeleoperatorType === "direct" &&
        directProcessRef.current
      ) {
        directProcessRef.current.start();
      }

      setControlEnabled(true);
      return true;
    }
    return false;
  }, [robot.isConnected, initializeTeleoperation, selectedTeleoperatorType]);

  // Disable robot control
  const disableControl = useCallback(async () => {
    if (keyboardProcessRef.current) {
      keyboardProcessRef.current.stop();
    }
    if (directProcessRef.current) {
      directProcessRef.current.stop();
    }
    setControlEnabled(false);
  }, [selectedTeleoperatorType]);

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
    if (teleopState.isActive && selectedTeleoperatorType === "keyboard") {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [
    teleopState.isActive,
    selectedTeleoperatorType,
    handleKeyDown,
    handleKeyUp,
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
        } catch (error) {
          console.warn("Error during teleoperation cleanup:", error);
        }
      };
      cleanup();
    };
  }, []);

  // Memoize teleoperators array for the Recorder component
  const memoizedTeleoperators = useMemo(() => {
    if (!controlEnabled) return [];

    // Return the active teleoperator based on selection
    const activeTeleoperator =
      selectedTeleoperatorType === "keyboard"
        ? keyboardProcessRef.current?.teleoperator
        : directProcessRef.current?.teleoperator;

    return activeTeleoperator ? [activeTeleoperator] : [];
  }, [controlEnabled, selectedTeleoperatorType]);

  return (
    <div className="space-y-6">
      {/* Robot Movement Recorder Header */}
      <Card className="border-0 rounded-none">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-1 h-8 bg-primary"></div>
              <div>
                <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">
                  robot movement recorder
                </h3>
                <p className="text-sm text-muted-foreground font-mono">
                  dataset{" "}
                  <span className="text-muted-foreground">recording</span>{" "}
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
                  onClick={() => setShowConfigure(!showConfigure)}
                >
                  <Settings className="w-5 h-5" />
                  Configure
                </Button>

                <Button
                  variant={
                    recorderCallbacks?.isRecording ? "destructive" : "default"
                  }
                  size="lg"
                  className="gap-2"
                  disabled={!robot.isConnected || !recorderCallbacks}
                  onClick={
                    recorderCallbacks?.isRecording
                      ? recorderCallbacks.stopRecording
                      : recorderCallbacks?.startRecording
                  }
                >
                  {recorderCallbacks?.isRecording ? (
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
              </div>
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
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          {/* Step-by-Step Recording Guide */}
          <div className="bg-black/40 border border-white/20 rounded-lg p-6">
            <h4 className="text-lg font-semibold text-foreground mb-4">
              How to Record Robot Data
            </h4>
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 border rounded-full flex items-center justify-center text-sm font-mono",
                    currentStep > 1
                      ? "bg-green-500/20 border-green-500/50 text-green-400" // Completed
                      : currentStep === 1
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" // Active
                      : "bg-muted/20 border-muted/50 text-muted-foreground" // Inactive
                  )}
                >
                  {currentStep > 1 ? <Check className="w-4 h-4" /> : "1"}
                </div>
                <div className="flex-1">
                  <h5 className="font-semibold text-foreground">
                    Enable Robot Control
                  </h5>
                  <p className="text-sm text-muted-foreground mb-3">
                    Choose how you want to control the robot during recording.
                  </p>

                  {!controlEnabled && robot.isConnected && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-sm text-muted-foreground min-w-0">
                          Control Type:
                        </label>
                        <Select
                          value={selectedTeleoperatorType}
                          onValueChange={(value: "direct" | "keyboard") =>
                            setSelectedTeleoperatorType(value)
                          }
                        >
                          <SelectTrigger className="w-48 bg-black/20 border-white/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="direct">
                              <div className="flex items-center gap-2">
                                <Gamepad2 className="w-4 h-4" />
                                Direct Control
                              </div>
                            </SelectItem>
                            <SelectItem value="keyboard">
                              <div className="flex items-center gap-2">
                                <Keyboard className="w-4 h-4" />
                                Keyboard Control
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedTeleoperatorType === "direct"
                          ? "Programmatic control (use teleoperation page for manual sliders)"
                          : "Move robot using keyboard keys (WASD, arrows, Q/E, O/C)"}
                      </p>
                    </div>
                  )}

                  <div className="mt-3">
                    <Button
                      variant={controlEnabled ? "destructive" : "default"}
                      onClick={controlEnabled ? disableControl : enableControl}
                      disabled={!robot.isConnected}
                      className="gap-2"
                      size="sm"
                    >
                      {selectedTeleoperatorType === "keyboard" ? (
                        <Keyboard className="w-4 h-4" />
                      ) : (
                        <Gamepad2 className="w-4 h-4" />
                      )}
                      {controlEnabled
                        ? `${selectedTeleoperatorType} Control Active`
                        : `Enable ${selectedTeleoperatorType} Control`}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 border rounded-full flex items-center justify-center text-sm font-mono",
                    currentStep > 2
                      ? "bg-green-500/20 border-green-500/50 text-green-400" // Completed
                      : currentStep === 2
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400" // Active
                      : "bg-muted/20 border-muted/50 text-muted-foreground" // Inactive
                  )}
                >
                  {currentStep > 2 ? <Check className="w-4 h-4" /> : "2"}
                </div>
                <div>
                  <h5
                    className={cn(
                      "font-semibold",
                      controlEnabled
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Start Recording
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    Click "Start Recording" to begin capturing robot movements.
                  </p>
                  {null}
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 border rounded-full flex items-center justify-center text-sm font-mono",
                    currentStep === 3
                      ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 animate-pulse" // Active with pulse
                      : "bg-muted/20 border-muted/50 text-muted-foreground" // Inactive
                  )}
                >
                  3
                </div>
                <div>
                  <h5
                    className={cn(
                      "font-semibold",
                      currentStep === 3
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    Move the Robot
                  </h5>
                  <p className="text-sm text-muted-foreground">
                    {currentStep === 3 ? (
                      <span className="text-yellow-400">
                        🎯 Recording active! Move the robot to demonstrate your
                        task.
                      </span>
                    ) : (
                      "Move the robot manually to demonstrate the task you want to teach. Recording will capture your movements."
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Robot Movement Recorder */}
          <Recorder
            teleoperators={memoizedTeleoperators}
            robot={robot}
            onNeedsTeleoperation={enableControl}
            showConfigure={showConfigure}
            onRecorderReady={setRecorderCallbacks}
          />
        </div>
      </Card>
    </div>
  );
}

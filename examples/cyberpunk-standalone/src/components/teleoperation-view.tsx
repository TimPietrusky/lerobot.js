"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Power, PowerOff, Keyboard, Box } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  teleoperate,
  type TeleoperationProcess,
  type TeleoperationState,
  type TeleoperateConfig,
  type RobotConnection,
} from "@lerobot/web";
// Import the LeRobotSO100 class directly from the package
import { LeRobotSO100 } from "@lerobot/web";
import { getUnifiedRobotData } from "@/lib/unified-storage";
import VirtualKey from "@/components/VirtualKey";
import { Recorder } from "@/components/recorder";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/cannon";
import * as THREE from "three";
import { OrbitControls } from "@react-three/drei";

interface TeleoperationViewProps {
  robot: RobotConnection;
}

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

// URDF Robot Component to display the robot model
function URDFRobotModel({ robotInstance }: { robotInstance: LeRobotSO100 | null }) {
  const [urdfRobot, setUrdfRobot] = useState<any>(null);

  useEffect(() => {
    if (robotInstance) {
      // Load the URDF model
      robotInstance.initialize().then(() => {
        setUrdfRobot(robotInstance.getURDF());
        robotInstance.setJoints({
          Elbow: Math.PI/2,
          Jaw: Math.PI/2,
          Pitch: Math.PI/2,
          Rotation: Math.PI/2,
          Wrist_Pitch: Math.PI/2,
          Wrist_Roll: Math.PI/2
        });
      }).catch((error: Error) => {
        console.error("Failed to load URDF model:", error);
      });
    }
  }, [robotInstance]);

  // If the URDF model is not loaded yet, show a loading message
  if (!urdfRobot) {
    return (
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  // Return the URDF model
  return (
    <primitive 
      object={urdfRobot} 
      position={[0, 0, 0]} 
      rotation={[-Math.PI/2, 0, 0]}
      scale={15}
    />
  );
}

export function TeleoperationView({ robot }: TeleoperationViewProps) {
  const [robotInstance, setRobotInstance] = useState<LeRobotSO100 | null>(null);
  const [teleopState, setTeleopState] = useState<TeleoperationState>({
    isActive: false,
    motorConfigs: [],
    lastUpdate: 0,
    keyStates: {},
  });

  const [isInitialized, setIsInitialized] = useState(false);
  // Local slider positions for immediate UI feedback with timestamps
  const [localMotorPositions, setLocalMotorPositions] = useState<{
    [motorName: string]: { position: number; timestamp: number };
  }>({});
  const keyboardProcessRef = useRef<TeleoperationProcess | null>(null);
  const directProcessRef = useRef<TeleoperationProcess | null>(null);
  const { toast } = useToast();

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

  // Initialize robot instance
  useEffect(() => {
    if (robot && robot.robotType) {
      const newRobotInstance = new LeRobotSO100();
      setRobotInstance(newRobotInstance);
    }
  }, [robot]);

  // Lazy initialization function - only connects when user wants to start
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
      };
      const directProcess = await teleoperate(directConfig);

      keyboardProcessRef.current = keyboardProcess;
      directProcessRef.current = directProcess;
      setTeleopState(keyboardProcess.getState());

      // Initialize local motor positions from hardware state
      const initialState = keyboardProcess.getState();
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

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!teleopState.isActive || !keyboardProcessRef.current) return;

      const key = event.key;
      event.preventDefault();

      const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
      if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
        (
          keyboardTeleoperator as {
            updateKeyState: (key: string, pressed: boolean) => void;
          }
        ).updateKeyState(key, true);
      }
    },
    [teleopState.isActive]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!teleopState.isActive || !keyboardProcessRef.current) return;

      const key = event.key;
      event.preventDefault();

      const keyboardTeleoperator = keyboardProcessRef.current.teleoperator;
      if (keyboardTeleoperator && "updateKeyState" in keyboardTeleoperator) {
        (
          keyboardTeleoperator as {
            updateKeyState: (key: string, pressed: boolean) => void;
          }
        ).updateKeyState(key, false);
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

    if (!keyboardProcessRef.current || !directProcessRef.current) {
      toast({
        title: "Teleoperation Error",
        description: "Teleoperation not initialized",
        variant: "destructive",
      });
      return;
    }

    try {
      keyboardProcessRef.current.start();
      directProcessRef.current.start();
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
      if (keyboardProcessRef.current) {
        keyboardProcessRef.current.stop();
      }
      if (directProcessRef.current) {
        directProcessRef.current.stop();
      }
    } catch (error) {
      console.warn("Error during teleoperation stop:", error);
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

  // Memoize teleoperators array to prevent unnecessary re-renders of the Recorder component
  const memoizedTeleoperators = useMemo(() => {
    if (!keyboardProcessRef.current || !directProcessRef.current) return [];
    return [
      keyboardProcessRef.current?.teleoperator,
      directProcessRef.current?.teleoperator,
    ].filter(Boolean);
  }, [keyboardProcessRef.current, directProcessRef.current]);

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
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground uppercase">
                    status:
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
                  <span className="font-bold text-sm font-sans">Shoulder</span>
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
                  <span className="font-bold text-sm font-sans">Roll/Grip</span>
                </div>
              </div>
              <div className="pt-4 border-t border-white/10">
                <div className="flex justify-between items-center font-mono text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Keyboard className="w-4 h-4" />
                    <span>
                      Active Keys:{" "}
                      {Object.values(keyStates).filter((k) => k.pressed).length}
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
        </div>
      </Card>

      {/* Robot Movement Recorder - Always show UI */}
      <Recorder
        teleoperators={memoizedTeleoperators}
        robot={robot}
        onNeedsTeleoperation={initializeTeleoperation}
      />
    </>
  );
}

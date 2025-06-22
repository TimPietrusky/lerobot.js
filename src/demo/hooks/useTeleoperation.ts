import { useState, useEffect, useCallback, useRef } from "react";
import { useRobotConnection } from "./useRobotConnection";
import { getUnifiedRobotData } from "../lib/unified-storage";
import type { RobotConnection } from "../../lerobot/web/find_port.js";

export interface MotorConfig {
  name: string;
  minPosition: number;
  maxPosition: number;
  currentPosition: number;
  homePosition: number;
}

export interface KeyState {
  pressed: boolean;
  lastPressed: number;
}

export interface UseTeleoperationOptions {
  robot: RobotConnection;
  enabled: boolean;
  onError?: (error: string) => void;
}

export interface UseTeleoperationResult {
  // Connection state from singleton
  isConnected: boolean;
  isActive: boolean;

  // Motor state
  motorConfigs: MotorConfig[];

  // Keyboard state
  keyStates: Record<string, KeyState>;

  // Error state
  error: string | null;

  // Control methods
  start: () => void;
  stop: () => void;
  goToHome: () => Promise<void>;
  simulateKeyPress: (key: string) => void;
  simulateKeyRelease: (key: string) => void;
  moveMotorToPosition: (motorIndex: number, position: number) => Promise<void>;
}

const MOTOR_CONFIGS: MotorConfig[] = [
  {
    name: "shoulder_pan",
    minPosition: 0,
    maxPosition: 4095,
    currentPosition: 2048,
    homePosition: 2048,
  },
  {
    name: "shoulder_lift",
    minPosition: 1024,
    maxPosition: 3072,
    currentPosition: 2048,
    homePosition: 2048,
  },
  {
    name: "elbow_flex",
    minPosition: 1024,
    maxPosition: 3072,
    currentPosition: 2048,
    homePosition: 2048,
  },
  {
    name: "wrist_flex",
    minPosition: 1024,
    maxPosition: 3072,
    currentPosition: 2048,
    homePosition: 2048,
  },
  {
    name: "wrist_roll",
    minPosition: 0,
    maxPosition: 4095,
    currentPosition: 2048,
    homePosition: 2048,
  },
  {
    name: "gripper",
    minPosition: 1800,
    maxPosition: 2400,
    currentPosition: 2100,
    homePosition: 2100,
  },
];

// PROVEN VALUES from Node.js implementation (conventions.md)
const SMOOTH_CONTROL_CONFIG = {
  STEP_SIZE: 25, // Proven optimal from conventions.md
  CHANGE_THRESHOLD: 0.5, // Prevents micro-movements and unnecessary commands
  MOTOR_DELAY: 1, // Minimal delay between motor commands (from conventions.md)
  UPDATE_INTERVAL: 30, // 30ms = ~33Hz for responsive control (was 50ms = 20Hz)
} as const;

const KEYBOARD_CONTROLS = {
  ArrowUp: { motorIndex: 1, direction: 1, description: "Shoulder lift up" },
  ArrowDown: {
    motorIndex: 1,
    direction: -1,
    description: "Shoulder lift down",
  },
  ArrowLeft: { motorIndex: 0, direction: -1, description: "Shoulder pan left" },
  ArrowRight: {
    motorIndex: 0,
    direction: 1,
    description: "Shoulder pan right",
  },
  w: { motorIndex: 2, direction: 1, description: "Elbow flex up" },
  s: { motorIndex: 2, direction: -1, description: "Elbow flex down" },
  a: { motorIndex: 3, direction: -1, description: "Wrist flex left" },
  d: { motorIndex: 3, direction: 1, description: "Wrist flex right" },
  q: { motorIndex: 4, direction: -1, description: "Wrist roll left" },
  e: { motorIndex: 4, direction: 1, description: "Wrist roll right" },
  o: { motorIndex: 5, direction: 1, description: "Gripper open" },
  c: { motorIndex: 5, direction: -1, description: "Gripper close" },
  Escape: { motorIndex: -1, direction: 0, description: "Emergency stop" },
};

export function useTeleoperation({
  robot,
  enabled,
  onError,
}: UseTeleoperationOptions): UseTeleoperationResult {
  const connection = useRobotConnection();
  const [isActive, setIsActive] = useState(false);
  const [motorConfigs, setMotorConfigs] =
    useState<MotorConfig[]>(MOTOR_CONFIGS);
  const [keyStates, setKeyStates] = useState<Record<string, KeyState>>({});
  const [error, setError] = useState<string | null>(null);

  const activeKeysRef = useRef<Set<string>>(new Set());
  const motorPositionsRef = useRef<number[]>(
    MOTOR_CONFIGS.map((m) => m.homePosition)
  );
  const movementIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load calibration data
  useEffect(() => {
    const loadCalibration = async () => {
      try {
        if (!robot.serialNumber) {
          console.warn("No serial number available for calibration loading");
          return;
        }

        const data = getUnifiedRobotData(robot.serialNumber);
        if (data?.calibration) {
          // Map motor names to calibration data
          const motorNames = [
            "shoulder_pan",
            "shoulder_lift",
            "elbow_flex",
            "wrist_flex",
            "wrist_roll",
            "gripper",
          ];
          const calibratedConfigs = MOTOR_CONFIGS.map((config, index) => {
            const motorName = motorNames[index] as keyof NonNullable<
              typeof data.calibration
            >;
            const calibratedMotor = data.calibration![motorName];
            if (
              calibratedMotor &&
              typeof calibratedMotor === "object" &&
              "homing_offset" in calibratedMotor &&
              "range_min" in calibratedMotor &&
              "range_max" in calibratedMotor
            ) {
              // Use 2048 as default home position, adjusted by homing offset
              const homePosition = 2048 + (calibratedMotor.homing_offset || 0);
              return {
                ...config,
                homePosition,
                currentPosition: homePosition,
                // IMPORTANT: Use actual calibrated limits instead of hardcoded ones
                minPosition: calibratedMotor.range_min || config.minPosition,
                maxPosition: calibratedMotor.range_max || config.maxPosition,
              };
            }
            return config;
          });
          setMotorConfigs(calibratedConfigs);
          // DON'T set motorPositionsRef here - it will be set when teleoperation starts
          // motorPositionsRef.current = calibratedConfigs.map((m) => m.homePosition);
          console.log("✅ Loaded calibration data for", robot.serialNumber);
        }
      } catch (error) {
        console.warn("Failed to load calibration:", error);
      }
    };

    loadCalibration();
  }, [robot.serialNumber]);

  // Keyboard event handlers
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive) return;

      const key = event.key;
      if (key in KEYBOARD_CONTROLS) {
        event.preventDefault();

        if (key === "Escape") {
          setIsActive(false);
          activeKeysRef.current.clear();
          return;
        }

        if (!activeKeysRef.current.has(key)) {
          activeKeysRef.current.add(key);
          setKeyStates((prev) => ({
            ...prev,
            [key]: { pressed: true, lastPressed: Date.now() },
          }));
        }
      }
    },
    [isActive]
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (!isActive) return;

      const key = event.key;
      if (key in KEYBOARD_CONTROLS) {
        event.preventDefault();
        activeKeysRef.current.delete(key);
        setKeyStates((prev) => ({
          ...prev,
          [key]: { pressed: false, lastPressed: Date.now() },
        }));
      }
    },
    [isActive]
  );

  // Register keyboard events
  useEffect(() => {
    if (enabled && isActive) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
      };
    }
  }, [enabled, isActive, handleKeyDown, handleKeyUp]);

  // CONTINUOUS MOVEMENT: For held keys with PROVEN smooth patterns from Node.js
  useEffect(() => {
    if (!isActive || !connection.isConnected) {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
        movementIntervalRef.current = null;
      }
      return;
    }

    const processMovement = async () => {
      if (activeKeysRef.current.size === 0) return;

      const activeKeys = Array.from(activeKeysRef.current);
      const changedMotors: Array<{ index: number; position: number }> = [];

      // PROVEN PATTERN: Process all active keys and collect changes
      for (const key of activeKeys) {
        const control =
          KEYBOARD_CONTROLS[key as keyof typeof KEYBOARD_CONTROLS];
        if (control && control.motorIndex >= 0) {
          const motorIndex = control.motorIndex;
          const direction = control.direction;
          const motor = motorConfigs[motorIndex];

          if (motor) {
            const currentPos = motorPositionsRef.current[motorIndex];
            let newPos =
              currentPos + direction * SMOOTH_CONTROL_CONFIG.STEP_SIZE;

            // Clamp to motor limits
            newPos = Math.max(
              motor.minPosition,
              Math.min(motor.maxPosition, newPos)
            );

            // PROVEN PATTERN: Only update if change is meaningful (0.5 unit threshold)
            if (
              Math.abs(newPos - currentPos) >
              SMOOTH_CONTROL_CONFIG.CHANGE_THRESHOLD
            ) {
              motorPositionsRef.current[motorIndex] = newPos;
              changedMotors.push({ index: motorIndex, position: newPos });
            }
          }
        }
      }

      // PROVEN PATTERN: Only send commands for motors that actually changed
      if (changedMotors.length > 0) {
        try {
          for (const { index, position } of changedMotors) {
            await connection.writeMotorPosition(index + 1, position);

            // PROVEN PATTERN: Minimal delay between motor commands (1ms)
            if (changedMotors.length > 1) {
              await new Promise((resolve) =>
                setTimeout(resolve, SMOOTH_CONTROL_CONFIG.MOTOR_DELAY)
              );
            }
          }

          // Update UI to reflect changes
          setMotorConfigs((prev) =>
            prev.map((config, index) => ({
              ...config,
              currentPosition: motorPositionsRef.current[index],
            }))
          );
        } catch (error) {
          console.warn("Failed to update robot positions:", error);
        }
      }
    };

    // PROVEN TIMING: 30ms interval (~33Hz) for responsive continuous movement
    movementIntervalRef.current = setInterval(
      processMovement,
      SMOOTH_CONTROL_CONFIG.UPDATE_INTERVAL
    );

    return () => {
      if (movementIntervalRef.current) {
        clearInterval(movementIntervalRef.current);
        movementIntervalRef.current = null;
      }
    };
  }, [
    isActive,
    connection.isConnected,
    connection.writeMotorPosition,
    motorConfigs,
  ]);

  // Control methods
  const start = useCallback(async () => {
    if (!connection.isConnected) {
      setError("Robot not connected");
      onError?.("Robot not connected");
      return;
    }

    try {
      console.log(
        "🎮 Starting teleoperation - reading current motor positions..."
      );

      // Read current positions of all motors using PROVEN utility
      const motorIds = [1, 2, 3, 4, 5, 6];
      const currentPositions = await connection.readAllMotorPositions(motorIds);

      // Log all positions (trust the utility's fallback handling)
      for (let i = 0; i < currentPositions.length; i++) {
        const position = currentPositions[i];
        console.log(`📍 Motor ${i + 1} current position: ${position}`);
      }

      // CRITICAL: Update positions BEFORE activating movement
      motorPositionsRef.current = currentPositions;

      // Update UI to show actual current positions
      setMotorConfigs((prev) =>
        prev.map((config, index) => ({
          ...config,
          currentPosition: currentPositions[index],
        }))
      );

      // IMPORTANT: Only activate AFTER positions are synchronized
      setIsActive(true);
      setError(null);
      console.log(
        "✅ Teleoperation started with synchronized positions:",
        currentPositions
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to start teleoperation";
      setError(errorMessage);
      onError?.(errorMessage);
      console.error("❌ Failed to start teleoperation:", error);
    }
  }, [
    connection.isConnected,
    connection.readAllMotorPositions,
    motorConfigs,
    onError,
  ]);

  const stop = useCallback(() => {
    setIsActive(false);
    activeKeysRef.current.clear();
    setKeyStates({});
    console.log("🛑 Teleoperation stopped");
  }, []);

  const goToHome = useCallback(async () => {
    if (!connection.isConnected) {
      setError("Robot not connected");
      return;
    }

    try {
      for (let i = 0; i < motorConfigs.length; i++) {
        const motor = motorConfigs[i];
        await connection.writeMotorPosition(i + 1, motor.homePosition);
        motorPositionsRef.current[i] = motor.homePosition;
      }

      setMotorConfigs((prev) =>
        prev.map((config) => ({
          ...config,
          currentPosition: config.homePosition,
        }))
      );

      console.log("🏠 Moved to home position");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to go to home";
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [
    connection.isConnected,
    connection.writeMotorPosition,
    motorConfigs,
    onError,
  ]);

  const simulateKeyPress = useCallback(
    (key: string) => {
      if (!isActive) return;

      activeKeysRef.current.add(key);
      setKeyStates((prev) => ({
        ...prev,
        [key]: { pressed: true, lastPressed: Date.now() },
      }));
    },
    [isActive]
  );

  const simulateKeyRelease = useCallback(
    (key: string) => {
      if (!isActive) return;

      activeKeysRef.current.delete(key);
      setKeyStates((prev) => ({
        ...prev,
        [key]: { pressed: false, lastPressed: Date.now() },
      }));
    },
    [isActive]
  );

  const moveMotorToPosition = useCallback(
    async (motorIndex: number, position: number) => {
      if (!connection.isConnected) {
        return;
      }

      try {
        await connection.writeMotorPosition(motorIndex + 1, position);

        // Update internal state
        motorPositionsRef.current[motorIndex] = position;

        setMotorConfigs((prev) =>
          prev.map((config, index) => ({
            ...config,
            currentPosition:
              index === motorIndex ? position : config.currentPosition,
          }))
        );
      } catch (error) {
        console.warn(
          `Failed to move motor ${motorIndex + 1} to position ${position}:`,
          error
        );
      }
    },
    [connection.isConnected, connection.writeMotorPosition]
  );

  return {
    isConnected: connection.isConnected,
    isActive,
    motorConfigs,
    keyStates,
    error,
    start,
    stop,
    goToHome,
    simulateKeyPress,
    simulateKeyRelease,
    moveMotorToPosition,
  };
}

/**
 * Teleoperation-related types for web implementation
 */

/**
 * Motor position and limits for teleoperation
 */
export interface MotorConfig {
  id: number;
  name: string;
  currentPosition: number;
  minPosition: number;
  maxPosition: number;
}

/**
 * Teleoperation state
 */
export interface TeleoperationState {
  isActive: boolean;
  motorConfigs: MotorConfig[];
  lastUpdate: number;
  keyStates: { [key: string]: { pressed: boolean; timestamp: number } };
}

/**
 * Teleoperation process control object
 */
export interface TeleoperationProcess {
  start(): void;
  stop(): void;
  updateKeyState(key: string, pressed: boolean): void;
  getState(): TeleoperationState;
  moveMotor(motorName: string, position: number): Promise<boolean>;
  setMotorPositions(positions: {
    [motorName: string]: number;
  }): Promise<boolean>;
  disconnect(): Promise<void>;
}

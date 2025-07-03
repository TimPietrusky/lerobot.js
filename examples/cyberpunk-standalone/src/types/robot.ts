export interface RobotConnection {
  port: object
  name: string
  isConnected: boolean
  robotType?: "so100_follower" | "so100_leader"
  robotId: string
  serialNumber?: string
}

export interface LiveCalibrationData {
  [motorName: string]: {
    current: number
    min: number
    max: number
    range: number
  }
}

export interface WebCalibrationResults {
  [motorName: string]: {
    min: number
    max: number
  }
}

export interface TeleoperationState {
  isActive: boolean
  motorConfigs: Array<{
    name: string
    currentPosition: number
    minPosition: number
    maxPosition: number
  }>
  keyStates: { [key: string]: { pressed: boolean } }
}

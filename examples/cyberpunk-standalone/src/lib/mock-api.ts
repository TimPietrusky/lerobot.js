import type { RobotConnection, LiveCalibrationData, WebCalibrationResults, TeleoperationState } from "@/types/robot"

const MOCK_MOTOR_NAMES = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"]

export const lerobot = {
  isWebSerialSupported: () => true,
  findPort: async ({
    robotConfigs,
    onMessage,
  }: { robotConfigs?: any[]; onMessage?: (msg: string) => void }): Promise<{ result: Promise<RobotConnection[]> }> => {
    onMessage?.("Searching for robots...")
    const resultPromise = new Promise<RobotConnection[]>((resolve) => {
      setTimeout(() => {
        if (robotConfigs && robotConfigs.length > 0) {
          onMessage?.(`Found ${robotConfigs.length} saved robots.`)
          const reconnectedRobots = robotConfigs.map((config) => ({
            ...config,
            isConnected: Math.random() > 0.3,
            port: {},
          }))
          resolve(reconnectedRobots)
        } else {
          onMessage?.("Simulating successful device connection.")
          const newRobot: RobotConnection = {
            port: {},
            name: "Cyber-Arm 7",
            isConnected: true,
            robotType: "so100_follower",
            robotId: `robot-${Date.now()}`,
            serialNumber: `SN-${Math.floor(Math.random() * 1000000)}`,
          }
          resolve([newRobot])
        }
      }, 1500)
    })
    return { result: resultPromise }
  },
  calibrate: async (
    robot: RobotConnection,
    {
      onLiveUpdate,
      onProgress,
    }: { onLiveUpdate: (data: LiveCalibrationData) => void; onProgress: (msg: string) => void },
  ): Promise<{ result: Promise<WebCalibrationResults>; stop: () => void }> => {
    onProgress("MOCK: Starting calibration... Move all joints to their limits.")
    let intervalId: NodeJS.Timeout
    const liveData: LiveCalibrationData = MOCK_MOTOR_NAMES.reduce((acc, name) => {
      acc[name] = { current: 2048, min: 4095, max: 0, range: 0 }
      return acc
    }, {} as LiveCalibrationData)
    intervalId = setInterval(() => {
      MOCK_MOTOR_NAMES.forEach((name) => {
        const motor = liveData[name]
        motor.current = 2048 + Math.floor((Math.random() - 0.5) * 4000)
        motor.min = Math.min(motor.min, motor.current)
        motor.max = Math.max(motor.max, motor.current)
        motor.range = motor.max - motor.min
      })
      onLiveUpdate({ ...liveData })
    }, 100)
    const resultPromise = new Promise<WebCalibrationResults>((resolve) => {
      ;(stop as any)._resolver = resolve
    })
    const stop = () => {
      clearInterval(intervalId)
      onProgress("MOCK: Calibration recording finished.")
      const finalResults = MOCK_MOTOR_NAMES.reduce((acc, name) => {
        acc[name] = { min: liveData[name].min, max: liveData[name].max }
        return acc
      }, {} as WebCalibrationResults)
      ;(stop as any)._resolver(finalResults)
    }
    return { result: resultPromise, stop }
  },
  teleoperate: async (
    robot: RobotConnection,
    {
      calibrationData,
      onStateUpdate,
    }: { calibrationData: WebCalibrationResults; onStateUpdate: (state: TeleoperationState) => void },
  ): Promise<{
    start: () => void
    stop: () => void
    updateKeyState: (key: string, pressed: boolean) => void
    moveMotor: (motorName: string, position: number) => void
  }> => {
    let isActive = false
    let intervalId: NodeJS.Timeout
    const keyStates: { [key: string]: { pressed: boolean } } = {}
    const motorConfigs = MOCK_MOTOR_NAMES.map((name) => ({
      name,
      currentPosition: calibrationData[name] ? (calibrationData[name].min + calibrationData[name].max) / 2 : 2048,
      minPosition: calibrationData[name]?.min ?? 0,
      maxPosition: calibrationData[name]?.max ?? 4095,
    }))
    const teleopState: TeleoperationState = { isActive, motorConfigs, keyStates }
    const updateLoop = () => onStateUpdate({ ...teleopState, motorConfigs: [...motorConfigs] })
    return {
      start: () => {
        if (isActive) return
        isActive = true
        teleopState.isActive = true
        intervalId = setInterval(updateLoop, 100)
        onStateUpdate({ ...teleopState })
      },
      stop: () => {
        if (!isActive) return
        isActive = false
        teleopState.isActive = false
        clearInterval(intervalId)
        onStateUpdate({ ...teleopState })
      },
      updateKeyState: (key: string, pressed: boolean) => {
        keyStates[key] = { pressed }
        teleopState.keyStates = { ...keyStates }
        onStateUpdate({ ...teleopState })
      },
      moveMotor: (motorName: string, position: number) => {
        const motor = motorConfigs.find((m) => m.name === motorName)
        if (motor) {
          motor.currentPosition = position
          onStateUpdate({ ...teleopState, motorConfigs: [...motorConfigs] })
        }
      },
    }
  },
  SO100_KEYBOARD_CONTROLS: {
    shoulder_pan: { positive: "ArrowRight", negative: "ArrowLeft" },
    shoulder_lift: { positive: "ArrowUp", negative: "ArrowDown" },
    elbow_flex: { positive: "w", negative: "s" },
    wrist_flex: { positive: "a", negative: "d" },
    wrist_roll: { positive: "q", negative: "e" },
    gripper: { positive: "o", negative: "c" },
    stop: "Escape",
  },
  MOCK_MOTOR_NAMES,
}

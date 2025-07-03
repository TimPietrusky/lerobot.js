"use client"
import { useState, useEffect, useMemo } from "react"
import { Power, PowerOff, Keyboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { lerobot } from "@/lib/mock-api"
import { useLocalStorage } from "@/hooks/use-local-storage"
import VirtualKey from "@/components/VirtualKey"
import type { RobotConnection, WebCalibrationResults, TeleoperationState } from "@/types/robot"

interface TeleoperationViewProps {
  robot: RobotConnection
}

export function TeleoperationView({ robot }: TeleoperationViewProps) {
  const [localCalibrationData] = useLocalStorage<WebCalibrationResults | null>(`calibration-${robot.robotId}`, null)
  const [teleopState, setTeleopState] = useState<TeleoperationState | null>(null)
  const [teleopProcess, setTeleopProcess] = useState<{
    start: () => void
    stop: () => void
    updateKeyState: (key: string, pressed: boolean) => void
    moveMotor: (motorName: string, position: number) => void
  } | null>(null)

  const calibrationData = useMemo(() => {
    if (localCalibrationData) return localCalibrationData
    return lerobot.MOCK_MOTOR_NAMES.reduce((acc, name) => {
      acc[name] = { min: 1000, max: 3000 }
      return acc
    }, {} as WebCalibrationResults)
  }, [localCalibrationData])

  useEffect(() => {
    let process: Awaited<ReturnType<typeof lerobot.teleoperate>>
    const setup = async () => {
      process = await lerobot.teleoperate(robot, {
        calibrationData,
        onStateUpdate: setTeleopState,
      })
      setTeleopProcess(process)
    }
    setup()

    const handleKeyDown = (e: KeyboardEvent) => process?.updateKeyState(e.key, true)
    const handleKeyUp = (e: KeyboardEvent) => process?.updateKeyState(e.key, false)

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      process?.stop()
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [robot, calibrationData])

  const motorConfigs =
    teleopState?.motorConfigs ??
    lerobot.MOCK_MOTOR_NAMES.map((name) => ({
      name,
      currentPosition: 2048,
      minPosition: calibrationData[name]?.min ?? 0,
      maxPosition: calibrationData[name]?.max ?? 4095,
    }))
  const keyStates = teleopState?.keyStates ?? {}
  const controls = lerobot.SO100_KEYBOARD_CONTROLS

  return (
    <Card className="border-0 rounded-none">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-1 h-8 bg-primary"></div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">robot control</h3>
              <p className="text-sm text-muted-foreground font-mono">
                manual <span className="text-muted-foreground">teleoperate</span> interface
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="border-l border-white/10 pl-6 flex items-center gap-4">
              {teleopState?.isActive ? (
                <Button onClick={() => teleopProcess?.stop()} variant="destructive" size="lg">
                  <PowerOff className="w-5 h-5 mr-2" /> Stop Control
                </Button>
              ) : (
                <Button onClick={() => teleopProcess?.start()} size="lg">
                  <Power className="w-5 h-5 mr-2" /> Control Robot
                </Button>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-muted-foreground uppercase">status:</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-primary/50 bg-primary/20 text-primary font-mono text-xs",
                    teleopState?.isActive && "animate-pulse-slow",
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
          <h3 className="font-sans font-semibold mb-4 text-xl">Motor Control</h3>
          <div className="space-y-6">
            {motorConfigs.map((motor) => (
              <div key={motor.name}>
                <label className="text-sm font-mono text-muted-foreground">{motor.name}</label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[motor.currentPosition]}
                    min={motor.minPosition}
                    max={motor.maxPosition}
                    step={1}
                    onValueChange={(val) => teleopProcess?.moveMotor(motor.name, val[0])}
                    disabled={!teleopState?.isActive}
                  />
                  <span className="text-lg font-mono w-16 text-right text-accent">
                    {Math.round(motor.currentPosition)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-sans font-semibold mb-4 text-xl">Keyboard Layout & Status</h3>
          <div className="p-4 bg-black/30 rounded-lg space-y-4">
            <div className="flex justify-around items-end">
              <div className="flex flex-col items-center gap-2">
                <VirtualKey
                  label="↑"
                  subLabel="Lift+"
                  isPressed={!!keyStates[controls.shoulder_lift.positive]?.pressed}
                />
                <div className="flex gap-2">
                  <VirtualKey
                    label="←"
                    subLabel="Pan-"
                    isPressed={!!keyStates[controls.shoulder_pan.negative]?.pressed}
                  />
                  <VirtualKey
                    label="↓"
                    subLabel="Lift-"
                    isPressed={!!keyStates[controls.shoulder_lift.negative]?.pressed}
                  />
                  <VirtualKey
                    label="→"
                    subLabel="Pan+"
                    isPressed={!!keyStates[controls.shoulder_pan.positive]?.pressed}
                  />
                </div>
                <span className="font-bold text-sm font-sans">Shoulder</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <VirtualKey
                  label="W"
                  subLabel="Elbow+"
                  isPressed={!!keyStates[controls.elbow_flex.positive]?.pressed}
                />
                <div className="flex gap-2">
                  <VirtualKey
                    label="A"
                    subLabel="Wrist+"
                    isPressed={!!keyStates[controls.wrist_flex.positive]?.pressed}
                  />
                  <VirtualKey
                    label="S"
                    subLabel="Elbow-"
                    isPressed={!!keyStates[controls.elbow_flex.negative]?.pressed}
                  />
                  <VirtualKey
                    label="D"
                    subLabel="Wrist-"
                    isPressed={!!keyStates[controls.wrist_flex.negative]?.pressed}
                  />
                </div>
                <span className="font-bold text-sm font-sans">Elbow/Wrist</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <VirtualKey
                    label="Q"
                    subLabel="Roll+"
                    isPressed={!!keyStates[controls.wrist_roll.positive]?.pressed}
                  />
                  <VirtualKey
                    label="E"
                    subLabel="Roll-"
                    isPressed={!!keyStates[controls.wrist_roll.negative]?.pressed}
                  />
                </div>
                <div className="flex gap-2">
                  <VirtualKey label="O" subLabel="Grip+" isPressed={!!keyStates[controls.gripper.positive]?.pressed} />
                  <VirtualKey label="C" subLabel="Grip-" isPressed={!!keyStates[controls.gripper.negative]?.pressed} />
                </div>
                <span className="font-bold text-sm font-sans">Roll/Grip</span>
              </div>
            </div>
            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center font-mono text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Keyboard className="w-4 h-4" />
                  <span>Active Keys: {Object.values(keyStates).filter((k) => k.pressed).length}</span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "w-10 h-6 border rounded-md flex items-center justify-center font-mono text-xs transition-all",
                          !!keyStates[controls.stop]?.pressed
                            ? "bg-destructive text-destructive-foreground border-destructive"
                            : "bg-background",
                        )}
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
  )
}

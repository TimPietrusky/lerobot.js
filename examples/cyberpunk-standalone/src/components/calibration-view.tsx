"use client"
import { useState, useMemo } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { lerobot } from "@/lib/mock-api"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { MotorCalibrationVisual } from "@/components/motor-calibration-visual"
import type { RobotConnection, LiveCalibrationData, WebCalibrationResults } from "@/types/robot"

interface CalibrationViewProps {
  robot: RobotConnection
}

export function CalibrationView({ robot }: CalibrationViewProps) {
  const [status, setStatus] = useState("Ready to calibrate.")
  const [liveData, setLiveData] = useState<LiveCalibrationData | null>(null)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationProcess, setCalibrationProcess] = useState<{
    stop: () => void
    result: Promise<WebCalibrationResults>
  } | null>(null)
  const [calibrationResults, setCalibrationResults] = useLocalStorage<WebCalibrationResults | null>(
    `calibration-${robot.robotId}`,
    null,
  )

  const handleStart = async () => {
    setIsCalibrating(true)
    const process = await lerobot.calibrate(robot, {
      onLiveUpdate: setLiveData,
      onProgress: setStatus,
    })
    setCalibrationProcess(process)
  }

  const handleFinish = async () => {
    if (calibrationProcess) {
      calibrationProcess.stop()
      const results = await calibrationProcess.result
      setCalibrationResults(results)
      setIsCalibrating(false)
      setCalibrationProcess(null)
    }
  }

  const downloadJson = () => {
    if (!calibrationResults) return
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(calibrationResults, null, 2))
    const downloadAnchorNode = document.createElement("a")
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", `${robot.robotId}_calibration.json`)
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  const motorData = useMemo(
    () =>
      liveData
        ? Object.entries(liveData)
        : lerobot.MOCK_MOTOR_NAMES.map((name) => [name, { current: 0, min: 4095, max: 0, range: 0 }]),
    [liveData],
  )

  return (
    <Card className="border-0 rounded-none">
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-1 h-8 bg-primary"></div>
          <div>
            <h3 className="text-xl font-bold text-foreground font-mono tracking-wider uppercase">motor calibration</h3>
            <p className="text-sm text-muted-foreground font-mono">move all joints to their limits</p>
          </div>
        </div>
        <div className="flex gap-4">
          {!isCalibrating ? (
            <Button onClick={handleStart} size="lg">
              Start Calibration
            </Button>
          ) : (
            <Button onClick={handleFinish} variant="destructive" size="lg">
              Finish Recording
            </Button>
          )}
          <Button onClick={downloadJson} variant="outline" size="lg" disabled={!calibrationResults}>
            <Download className="w-4 h-4 mr-2" /> Download JSON
          </Button>
        </div>
      </div>
      <div className="pt-6 p-6">
        <div className="flex items-center gap-4 py-2 px-4 text-sm font-sans text-muted-foreground">
          <div className="w-40">Motor Name</div>
          <div className="flex-1">Visual Range</div>
          <div className="w-16 text-right">Current</div>
          <div className="w-16 text-right">Min</div>
          <div className="w-16 text-right">Max</div>
          <div className="w-16 text-right">Range</div>
        </div>
        <div className="border-t border-white/10">
          {motorData.map(([name, data]) => (
            <MotorCalibrationVisual key={name} name={name} data={data} />
          ))}
        </div>
      </div>
    </Card>
  )
}

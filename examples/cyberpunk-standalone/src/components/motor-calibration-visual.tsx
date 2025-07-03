interface MotorCalibrationVisualProps {
  name: string
  data: { current: number; min: number; max: number; range: number }
}

export function MotorCalibrationVisual({ name, data }: MotorCalibrationVisualProps) {
  const totalRange = 4095 // Standard range for many servos
  const toPercent = (val: number) => (val / totalRange) * 100

  const currentPos = toPercent(data.current)
  const minPos = toPercent(data.min)
  const maxPos = toPercent(data.max)
  const rangeWidth = maxPos - minPos

  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-40 font-mono text-muted-foreground">{name}</div>
      <div className="flex-1">
        <div className="h-6 bg-black/30 rounded-sm relative overflow-hidden">
          {data.range > 0 && (
            <div className="absolute h-full bg-primary/20" style={{ left: `${minPos}%`, width: `${rangeWidth}%` }} />
          )}
          <div className="absolute top-0 h-full w-1 bg-accent" style={{ left: `calc(${currentPos}% - 2px)` }} />
        </div>
      </div>
      <div className="w-16 text-right font-mono text-lg">{data.current}</div>
      <div className="w-16 text-right font-mono text-lg text-primary/80">{data.min === 4095 ? "N/A" : data.min}</div>
      <div className="w-16 text-right font-mono text-lg text-primary/80">{data.max === 0 ? "N/A" : data.max}</div>
      <div className="w-16 text-right font-mono text-lg text-accent">{data.range}</div>
    </div>
  )
}

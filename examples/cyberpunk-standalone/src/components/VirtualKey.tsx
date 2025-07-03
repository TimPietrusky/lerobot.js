import { cn } from "@/lib/utils"

interface VirtualKeyProps {
  label: string
  subLabel?: string
  isPressed?: boolean
}

const VirtualKey = ({ label, subLabel, isPressed }: VirtualKeyProps) => {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "w-12 h-12 border rounded-md flex items-center justify-center font-bold transition-all duration-100",
          isPressed
            ? "bg-primary text-primary-foreground scale-110 border-primary"
            : "bg-black/30 text-muted-foreground border-white/10",
        )}
      >
        {label}
      </div>
      {subLabel && <span className="text-xs text-muted-foreground mt-1 font-mono">{subLabel}</span>}
    </div>
  )
}

export default VirtualKey

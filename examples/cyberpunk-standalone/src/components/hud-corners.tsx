import type React from "react"
import { cn } from "@/lib/utils"

const HudCorners = ({
  children,
  className,
  color = "primary",
  size = "md",
  layer = "behind",
}: {
  children: React.ReactNode
  className?: string
  color?: "primary" | "whiteMuted"
  size?: "sm" | "md" | "lg" | "xl"
  layer?: "behind" | "front" | "top"
}) => {
  // Define size variants for corner dimensions
  const sizeClasses = {
    sm: "w-4 h-4", // 16px × 16px - small corners
    md: "w-6 h-6", // 24px × 24px - default
    lg: "w-8 h-8", // 32px × 32px - large corners
    xl: "w-12 h-12", // 48px × 48px - extra large corners
  }

  // Define layer/z-index variants
  const layerClasses = {
    behind: "z-0", // Behind content (default behavior)
    front: "z-10", // Above most content
    top: "z-50", // Above almost everything (modals, dropdowns, etc.)
  }

  const cornerClasses = `absolute ${sizeClasses[size]} ${layerClasses[layer]}`
  const colorClasses = color === "primary" ? "border-primary/80" : "border-muted-foreground/30"

  return (
    <div className={cn("relative", className)}>
      <div className={`${cornerClasses} ${colorClasses} top-0 left-0 border-t border-l`}></div>
      <div className={`${cornerClasses} ${colorClasses} top-0 right-0 border-t border-r`}></div>
      <div className={`${cornerClasses} ${colorClasses} bottom-0 left-0 border-b border-l`}></div>
      <div className={`${cornerClasses} ${colorClasses} bottom-0 right-0 border-b border-r`}></div>
      {children}
    </div>
  )
}

export default HudCorners

"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"

const bootLines = [
  "INITIALIZING BIOS...",
  "CHECKING MEMORY: 1024MB OK",
  "DETECTING PRIMARY BUS...",
  "LEROBOT.JS CORE v1.0.2",
  "LOADING OPERATOR CONSOLE...",
  "CONNECTION PROTOCOL: WEBSERIAL",
  "ENCRYPTION: AES-256",
  "SYSTEM STATUS: NOMINAL",
  "BOOT SEQUENCE COMPLETE.",
]

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState<string[]>([])
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = []
    bootLines.forEach((line, index) => {
      timeouts.push(
        setTimeout(() => {
          setVisibleLines((prev) => [...prev, line])
        }, index * 150),
      )
    })

    timeouts.push(
      setTimeout(
        () => {
          setShow(false)
          setTimeout(onComplete, 500) // Wait for fade out
        },
        bootLines.length * 150 + 500,
      ),
    )

    return () => timeouts.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-500",
        show ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div className="font-mono text-primary text-sm md:text-base p-4">
        {visibleLines.map((line, index) => (
          <p key={index} className="text-glitch" data-text={line}>
            &gt; {line}
          </p>
        ))}
      </div>
    </div>
  )
}

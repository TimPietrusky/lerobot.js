"use client"

import type React from "react"

import { useEffect } from "react"

export function GridBackground({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      document.body.style.setProperty("--mouse-x", `${e.clientX}px`)
      document.body.style.setProperty("--mouse-y", `${e.clientY}px`)
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  return <>{children}</>
}

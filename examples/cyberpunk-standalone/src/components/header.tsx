import { ThemeToggle } from "./theme-toggle"

export function Header() {
  return (
    <header className="w-full border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold">LeRobot.js</h1>
          <div className="flex items-center gap-2 text-primary font-mono text-sm">
            <span className="text-xs text-muted-foreground font-mono">
              interact with your robot in JS, inspired by{" "}
              <a
                href="https://huggingface.co/docs/lerobot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-accent transition-colors underline"
              >
                LeRobot
              </a>
            </span>
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}

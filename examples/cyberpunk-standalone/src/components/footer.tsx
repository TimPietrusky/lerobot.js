import { Github } from "lucide-react"

export function Footer() {
  return (
    <footer className="w-full border-t">
      <div className="container mx-auto flex h-16 items-center justify-center px-4 md:px-6">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Created with ❤️ by{" "}
            <a
              href="https://github.com/timpietrusky"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent transition-colors underline"
            >
              Tim Pietrusky
            </a>{" "}
            under{" "}
            <a
              href="https://github.com/timpietrusky/lerobot.js/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-accent transition-colors underline"
            >
              Apache 2.0
            </a>
          </span>
          <a
            href="https://github.com/timpietrusky/lerobot.js"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </div>
      </div>
    </footer>
  )
}

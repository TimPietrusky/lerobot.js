import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { existsSync } from "fs";

export default defineConfig(({ mode }) => {
  // Check if we're in a workspace environment (has packages/web/src)
  const isWorkspace = existsSync(resolve(__dirname, "./packages/web/src"));

  const baseConfig = {
    plugins: [],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
        // Only add workspace alias if in workspace environment
        ...(isWorkspace && {
          "@lerobot/web": resolve(__dirname, "./packages/web/src"),
        }),
      },
    },
  };

  if (mode === "demo") {
    // React demo mode - includes React, Tailwind, shadcn/ui
    return {
      ...baseConfig,
      plugins: [react()],
      css: {
        postcss: "./postcss.config.mjs",
      },
      build: {
        outDir: "dist/demo",
        rollupOptions: {
          input: {
            main: resolve(__dirname, "index.html"),
          },
        },
      },
    };
  }

  if (mode === "vanilla") {
    // Vanilla mode - current implementation without React
    return {
      ...baseConfig,
      build: {
        outDir: "dist/vanilla",
        rollupOptions: {
          input: {
            main: resolve(__dirname, "vanilla.html"),
          },
        },
      },
    };
  }

  if (mode === "test") {
    // Test mode - sequential operations test
    return {
      ...baseConfig,
      server: {
        open: "/examples/test-sequential-operations.html",
      },
      build: {
        outDir: "dist/test",
        rollupOptions: {
          input: {
            main: resolve(
              __dirname,
              "examples/test-sequential-operations.html"
            ),
          },
        },
      },
    };
  }

  if (mode === "lib") {
    // Library mode - core library without any demo UI
    return {
      ...baseConfig,
      build: {
        lib: {
          entry: resolve(__dirname, "src/main.ts"),
          name: "LeRobot",
          fileName: "lerobot",
        },
        rollupOptions: {
          external: ["serialport", "react", "react-dom"],
          output: {
            globals: {
              serialport: "SerialPort",
              react: "React",
              "react-dom": "ReactDOM",
            },
          },
        },
      },
    };
  }

  // Default mode (fallback to demo)
  return defineConfig({ mode: "demo" });
});

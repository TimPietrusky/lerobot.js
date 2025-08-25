import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: {
        main: resolve(__dirname, "src/main.ts"),
        "demo-find-port": resolve(__dirname, "src/demo-find-port.ts"),
        "demo-calibrate": resolve(__dirname, "src/demo-calibrate.ts"),
        "demo-teleoperate": resolve(__dirname, "src/demo-teleoperate.ts"),
      },
      formats: ["es"],
      fileName: (format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        "fs",
        "fs/promises",
        "path",
        "os",
        "readline",
        "process",
        // Dependencies that should remain external
        "serialport",
        "@lerobot/node",
      ],
    },
    outDir: "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});

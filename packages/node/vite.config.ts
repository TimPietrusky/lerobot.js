import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: {
        index: "src/index.ts",
        calibrate: "src/calibrate.ts",
        teleoperate: "src/teleoperate.ts",
        find_port: "src/find_port.ts",
        release_motors: "src/release_motors.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        "fs",
        "path",
        "os",
        "readline",
        "util",
        "events",
        "stream",
        "fs/promises",
        // External dependencies
        "serialport",
      ],
    },
    minify: false,
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist", "node_modules"],
  },
});

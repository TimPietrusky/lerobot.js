import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "node18",
    lib: {
      entry: {
        cli: "src/cli.ts",
        index: "src/index.ts",
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [
        // Node.js built-ins
        "fs",
        "fs/promises",
        "path",
        "os",
        "readline",
        "util",
        "events",
        "stream",
        "url",
        // External dependencies
        "@lerobot/node",
        "chalk",
        "commander",
        "serialport",
      ],
    },
    minify: false,
    sourcemap: true,
  },
});

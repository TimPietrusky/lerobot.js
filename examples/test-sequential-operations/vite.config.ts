import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@lerobot/web": resolve(__dirname, "../../packages/web/src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "test-sequential-operations.html"),
      },
    },
  },
  server: {
    open: "/test-sequential-operations.html",
  },
});

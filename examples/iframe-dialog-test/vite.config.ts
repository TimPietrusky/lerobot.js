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
        main: resolve(__dirname, "iframe-dialog-test.html"),
        content: resolve(__dirname, "iframe-content.html"),
      },
    },
  },
  server: {
    open: "/iframe-dialog-test.html",
  },
});

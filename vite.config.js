import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const libPath = path.resolve(__dirname, "../dendrochronology-visualizer/src");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "dendrochronology-visualizer/react": path.join(libPath, "react/index.js"),
      "dendrochronology-visualizer": path.join(libPath, "index.js"),
    },
  },
});

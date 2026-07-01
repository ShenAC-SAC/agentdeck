import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const HUB = "http://localhost:8799";

// `root: "web"` holds index.html + the React app; the production build lands
// in web/dist, which the hub serves. The dev server proxies the hub's
// API/stream so `bun run web:dev` (HMR) talks to a running `deck` hub.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: {
    proxy: {
      "/sessions": HUB,
      "/spawn": HUB,
      "/jump": HUB,
      "/events/stream": { target: HUB, ws: true },
    },
  },
});

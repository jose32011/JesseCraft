import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    proxy: {
      "/ws": {
        target: process.env.GAME_SERVER_URL ?? "ws://127.0.0.1:3001",
        ws: true,
      },
    },
  },
});

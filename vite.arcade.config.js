import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const arcadeServer = process.env.ARCADE_SERVER_URL ?? "http://127.0.0.1:3101";
const jesseCraftServer = process.env.GAME_SERVER_URL ?? arcadeServer.replace(/^http/, "ws");

export default defineConfig({
  root: fileURLToPath(new URL("./JesseArcade/public/", import.meta.url)),
  publicDir: false,
  plugins: [
    {
      name: "arcade-dev-launcher",
      transformIndexHtml: {
        order: "pre",
        handler() {
          return [
            {
              tag: "script",
              children: "localStorage.setItem('arcade-active-game', 'menu');",
              injectTo: "head-prepend",
            },
          ];
        },
      },
    },
  ],
  server: {
    host: "0.0.0.0",
    proxy: {
      "/socket.io": {
        target: arcadeServer,
        ws: true,
        changeOrigin: true,
      },
      "/ws": {
        target: jesseCraftServer,
        ws: true,
      },
      "/api": arcadeServer,
      "/admin": arcadeServer,
      "/jesse-craft": arcadeServer,
      "/pokemon-arena": arcadeServer,
      "/pokemon": arcadeServer,
    },
  },
});

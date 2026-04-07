import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      manifest: {
        name: "E-Library",
        short_name: "E-Library",
        description: "E-Library PWA",
        theme_color: "#0b1220",
        background_color: "#0b1220",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ],

  server: {
    proxy: {
      "/api/auth": {
        target: "https://api.elibapp.io.vn",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, "")
      },

      "/api/catalog": {
        target: "https://api.elibapp.io.vn",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/catalog/, "")
      },

      "/api/borrow": {
        target: "https://api.elibapp.io.vn",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/borrow/, "")
      }
    }
  }
});
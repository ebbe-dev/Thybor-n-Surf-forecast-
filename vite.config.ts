import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Appen serveres fra https://ebbe-dev.github.io/Thybor-n-Surf-forecast-/
const BASE = "/Thybor-n-Surf-forecast-/";

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Byg Tangen",
        short_name: "Byg Tangen",
        description: "Surf-forecast for Harboøre Tange / Thyborøn",
        lang: "da",
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait",
        background_color: "#0B1917",
        theme_color: "#0B1917",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // App-skallen precaches; forecast-data cachelagres separat i localStorage
        // (lib/storage.ts) så sidste hentede forecast altid kan vises offline.
        // navigateFallback sættes af pluginet ud fra base
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"]
      }
    })
  ]
});

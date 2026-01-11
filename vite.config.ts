import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icon-192.png",
        "icon-512.png",
        "logo-white.png",
        "logo-black.png",
        "exercises/*.jpg",
      ],
      manifest: false, // Use existing manifest.json
      devOptions: {
        enabled: false, // PWA disabled in dev mode - use npm run build && npm run preview to test
      },
      workbox: {
        // Precache all assets including lazy-loaded chunks
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2,json,jpg,jpeg,webp}",
        ],
        // Increase precache size limit for all chunks
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/auth/],
        runtimeCaching: [
          {
            // Cache app JS/CSS chunks (for lazy loading)
            urlPattern: /\/assets\/.*\.(js|css)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "app-assets",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Cache local exercise images
            urlPattern: /\/exercises\/.*\.(jpg|jpeg|png|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "exercise-images",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache Supabase storage (exercise images, avatars)
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-storage",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Skip Supabase API/auth requests - app handles offline with IndexedDB
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI components
          'ui-vendor': [
            'lucide-react',
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
            '@radix-ui/react-popover',
          ],

          // Date utilities
          'date-vendor': ['date-fns'],

          // Data layer - Supabase
          'supabase-vendor': ['@supabase/supabase-js'],

          // Data layer - React Query
          'query-vendor': ['@tanstack/react-query'],

          // Offline/IndexedDB
          'offline-vendor': ['dexie', 'dexie-react-hooks'],

          // i18n
          'i18n-vendor': ['i18next', 'react-i18next'],

          // Other utilities
          'utils-vendor': ['sonner', 'class-variance-authority', 'clsx', 'tailwind-merge'],
        },
      },
    },
  },
}));

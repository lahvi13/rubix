/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  // Shown in the header so anyone can tell at a glance which build they run —
  // service worker updates are otherwise invisible.
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [
    react(),
    VitePWA({
      // Never swap the app out from under a running solve — the user reloads.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Rubix',
        short_name: 'Rubix',
        description: 'Offline speedcubing trainer',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // cubing.js pulls in wasm and lazy chunks; all of it has to be offline.
        // The fonts too: a face that only arrives over the network is a face
        // the app has on the first run and never again.
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // The preload helper Vite wires into dynamic imports touches `document`,
    // and cubing runs its dynamically-importing chunks inside workers, where
    // that is fatal. Preloading buys nothing here anyway: the service worker
    // precaches every chunk.
    modulePreload: false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // cubing modules shared between lazy chunks must never be hoisted
            // into the app entry chunk: cubing spawns workers from its own
            // emitted chunks, and a worker whose import chain reaches the
            // React entry dies on `document` before it can answer anything.
            {
              name: 'cubing-shared',
              test: /node_modules[\\/]cubing[\\/]/,
              minShareCount: 2,
            },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

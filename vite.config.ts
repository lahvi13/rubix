/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * Which build this is. The version in package.json changes when it is bumped
 * by hand, which is never often enough to answer "is the phone running what I
 * just deployed?" — the commit does.
 */
const commit = ((): string => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    // A build from a tarball, or without git. The version alone will do.
    return 'local';
  }
})();

export default defineConfig({
  // Shown in the header so anyone can tell at a glance which build they run —
  // service worker updates are otherwise invisible.
  define: {
    __APP_VERSION__: JSON.stringify(`${version}·${commit}`),
  },
  plugins: [
    react(),
    VitePWA({
      // Never swap the app out from under a running solve — the user reloads.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        // The identity of the installed app, pinned: without it the id is
        // derived from start_url, and moving that would install a second copy
        // beside the one already on someone's home screen.
        id: '/',
        name: 'Rubix',
        short_name: 'Rubix',
        description: 'Offline speedcubing trainer',
        lang: 'en',
        theme_color: '#0f1115',
        background_color: '#0f1115',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
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
        // Deliberately no runtimeCaching: the analytics beacon from
        // static.cloudflareinsights.com must always reach the network. If a rule
        // is ever added here, exclude that origin from it.
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

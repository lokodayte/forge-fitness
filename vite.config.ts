/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Base path for the deployed site.
 *
 * - Project site (https://<user>.github.io/<repo>/): VITE_BASE=/<repo>/
 * - User/organisation site or custom domain:         VITE_BASE=/
 *
 * The GitHub Actions workflow sets this automatically from the repository name.
 * The app uses hash-based routing (#/route), so refreshing any page works on
 * GitHub Pages without server rewrites.
 */
function resolveBase(): string {
  const raw = process.env.VITE_BASE?.trim();
  if (!raw) return '/';
  let base = raw.startsWith('/') || raw.startsWith('.') ? raw : `/${raw}`;
  if (!base.endsWith('/')) base += '/';
  return base;
}

const base = resolveBase();

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/*.png', 'icons/*.svg', 'media/exercises/*.svg'],
      manifest: {
        name: 'FORGE — Fitness Tracker',
        short_name: 'FORGE',
        description: 'Local-first personal training, cardio, nutrition and recovery tracker.',
        theme_color: '#0b0c0e',
        background_color: '#0b0c0e',
        display: 'standalone',
        orientation: 'any',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
});

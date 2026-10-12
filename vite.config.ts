import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Bike-Builder/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeManifestIcons: false, // icons come network-first (see runtimeCaching)
      manifest: {
        name: 'Bike Builder',
        short_name: 'Bike Builder',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'icons/icon-v2-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-v2-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // Hashed JS/CSS are precached. The page and icons are fetched network-first so a new
        // deploy (or a new icon) shows on the next open; the cached copy is only used offline.
        globPatterns: ['**/*.{js,css}'],
        globIgnores: ['sw.js', 'workbox-*.js', 'registerSW.js'],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => /\/(icons\/.*\.png|icon\.svg|manifest\.webmanifest)$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'icons', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
});

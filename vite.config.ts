import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Bike-Builder/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered in src/main.tsx (auto-reloads when a new version is ready)
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
        skipWaiting: true, // new version takes over immediately...
        clientsClaim: true, // ...and controls open pages (main.tsx then reloads once)
        runtimeCaching: [
          {
            // The page: always ask GitHub Pages for the latest (bypassing the browser's 10-min HTTP cache);
            // the saved copy is used only when offline or the network takes > 4 s.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: async ({ request }): Promise<Response> => {
              const cache = await caches.open('pages');
              const key = new URL('./', (self as unknown as { registration: { scope: string } }).registration.scope).href;
              try {
                const res = await Promise.race<Response>([
                  fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' }),
                  new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
                ]);
                if (!res.ok) throw new Error(String(res.status));
                await cache.put(key, res.clone());
                return res;
              } catch {
                return (await cache.match(key)) ?? Response.error();
              }
            },
          },
          {
            urlPattern: ({ url }) => /\/(icons\/.*\.png|icon\.svg|manifest\.webmanifest)$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'icons', networkTimeoutSeconds: 4, fetchOptions: { cache: 'no-cache' } },
          },
          {
            // Hashed bundles fetched by a newer page before its service worker takes over: keep them for offline.
            urlPattern: ({ url }) => url.pathname.includes('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'assets', expiration: { maxEntries: 40 } },
          },
        ],
      },
    }),
  ],
});

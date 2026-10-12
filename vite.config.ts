import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the site at /Bike-Builder/ (repo name, case-sensitive).
export default defineConfig({
  base: '/Bike-Builder/',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Bike Builder',
        short_name: 'Bike Builder',
        description: 'Personal sport bike build configurator',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '.',
        icons: [],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json}'] },
    }),
  ],
  test: { environment: 'node' },
});

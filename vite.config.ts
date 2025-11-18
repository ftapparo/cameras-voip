import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp}'],
        globIgnores: ['**/*.mp3', '**/stream/**', '**/api/**'],
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: []
      },
      manifest: {
        name: 'Cameras VoIP - Portaria',
        short_name: 'Portaria VoIP',
        description: 'Aplicação de monitoramento com VoIP para portaria',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#000000',
        theme_color: '#1976d2',
        screenshots: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            form_factor: 'narrow'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            form_factor: 'wide'
          }
        ],
        icons: [
          {
            src: '/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ]
});

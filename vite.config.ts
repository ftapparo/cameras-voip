import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tenta usar o certificado gerado, senão usa o básico
let httpsConfig = {};
const pfxPath = path.join(__dirname, 'certs', 'cert.pfx');

if (fs.existsSync(pfxPath)) {
  try {
    httpsConfig = {
      pfx: fs.readFileSync(pfxPath),
      passphrase: 'password'
    };
    console.log('✅ Usando certificado PFX gerado');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    console.log('⚠️  Não consegui ler PFX, usando certificado padrão');
  }
}

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,webp}'],
        globIgnores: ['**/*.{mp3,mp4,webm}', '**/stream/**', '**/api/**'],
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 5000000
      },
      manifest: {
        name: 'Portaria VoIP',
        short_name: 'Portaria',
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
  ],
  build: {
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    https: Object.keys(httpsConfig).length > 0 ? httpsConfig : undefined,
    host: '0.0.0.0',
    port: 5173
  },
  preview: {
    https: Object.keys(httpsConfig).length > 0 ? httpsConfig : undefined,
    host: '0.0.0.0',
    port: 4173
  }
});


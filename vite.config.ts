/* eslint-disable @typescript-eslint/no-unused-vars */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    minify: false,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    },
    commonjsOptions: {
      esmExternals: true
    }
  },
  server: {
    allowedHosts: ['.local', '.condominionovaresidence.com'],
    hmr: process.env.NODE_ENV === 'development' ? {
      protocol: 'ws',
      host: 'localhost',
      port: 5173
    } : undefined,
    proxy: {
      '/api/camera/106-direct': {
        target: 'http://192.168.0.106',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/camera\/106-direct/, '/cgi-bin/video.cgi'),
        secure: false,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, _req) => {
            // Só remove headers problemáticos, sem autenticação
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('authorization');
            proxyReq.setHeader('User-Agent', 'Camera-Viewer/1.0');
            console.log('Direct proxy request to:', proxyReq.path);
          });
          
          proxy.on('proxyRes', (proxyRes, _req, _res) => {
            console.log('Direct proxy response status:', proxyRes.statusCode);
            // Remove headers que podem causar problemas no browser
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = '*';
          });
        }
      }
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});

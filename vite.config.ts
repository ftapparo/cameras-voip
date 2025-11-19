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
    } : undefined
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});

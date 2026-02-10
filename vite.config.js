// File: vite.config.js
// Vite configuration for Darkmoon game

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  // Public assets (served/copied as-is). Game content lives under src/Resources.
  publicDir: 'src/Resources',
  base: './',
  server: {
    port: 3000,
    open: true,
    cors: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Keep build self-contained (no optional terser dependency required).
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@core': '/src/core',
      '@entities': '/src/entities',
      '@systems': '/src/systems',
      '@graphics': '/src/graphics',
      '@ui': '/src/ui'
    }
  }
});

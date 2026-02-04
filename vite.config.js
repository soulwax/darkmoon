// Vite configuration for Darkmoon game
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'Resources',
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
    minify: 'terser',
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

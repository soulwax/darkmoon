// File: vite.config.js
// Vite configuration for Darkmoon game

import { defineConfig } from 'vite';
import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

function darkmoonLogPlugin() {
  const logsDir = path.resolve(process.cwd(), 'logs');

  const appendRecord = (record) => {
    try {
      mkdirSync(logsDir, { recursive: true });
      const day = new Date().toISOString().slice(0, 10);
      const file = path.join(logsDir, `darkmoon-${day}.jsonl`);
      const payload = {
        receivedAt: new Date().toISOString(),
        ...record
      };
      appendFileSync(file, `${JSON.stringify(payload)}\n`, 'utf8');
    } catch {
      // Avoid crashing the dev server due to logging issues.
    }
  };

  const middleware = (req, res, next) => {
    const url = (req.url || '').split('?')[0];
    if (req.method !== 'POST' || url !== '/__darkmoon_log') {
      next();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 256 * 1024) {
        res.statusCode = 413;
        res.end('payload too large');
      }
    });

    req.on('end', () => {
      if (!body) {
        res.statusCode = 204;
        res.end();
        return;
      }

      try {
        const parsed = JSON.parse(body);
        appendRecord(parsed);
        res.statusCode = 204;
        res.end();
      } catch {
        res.statusCode = 400;
        res.end('invalid log payload');
      }
    });
  };

  return {
    name: 'darkmoon-log-plugin',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig({
  plugins: [darkmoonLogPlugin()],
  root: '.',
  // Public assets (served/copied as-is). Game content lives under src/Resources.
  publicDir: 'src/Resources',
  base: './',
  server: {
    port: 3000,
    open: true,
    cors: true,
    allowedHosts: true
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

import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginReact } from '@rsbuild/plugin-react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';

const envPath = resolve(__dirname, '..', '..', '.env');

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

const webHost = process.env.WEB_HOST ?? '127.0.0.1';
const webPort = Number(process.env.WEB_PORT ?? 4200);
const apiHost = process.env.API_HOST ?? '127.0.0.1';
const apiPort = Number(process.env.API_PORT ?? 3000);

export default defineConfig({
  html: {
    template: './src/index.html',
  },
  plugins: [pluginReact(), pluginLess()],
  source: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    entry: {
      index: './src/main.tsx',
    },
    tsconfigPath: './tsconfig.app.json',
  },
  server: {
    host: webHost,
    port: webPort,
    proxy: {
      '/api': `http://${apiHost}:${apiPort}`,
    },
  },
  output: {
    copy: [{ from: './src/favicon.ico' }, { from: './src/assets' }],
    target: 'web',
    distPath: {
      root: 'dist',
    },
  },
});

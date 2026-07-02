import { defineConfig } from '@rsbuild/core';
import { pluginLess } from '@rsbuild/plugin-less';
import { pluginReact } from '@rsbuild/plugin-react';
import { resolve } from 'node:path';

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
    port: 4200,
  },
  output: {
    copy: [{ from: './src/favicon.ico' }, { from: './src/assets' }],
    target: 'web',
    distPath: {
      root: 'dist',
    },
  },
});

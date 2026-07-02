import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'apps/web/dist');
const target = resolve(root, 'dist/apps/web');

if (!existsSync(source)) {
  throw new Error(`Web dist not found: ${source}`);
}

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });

console.log(`Copied ${source} to ${target}`);

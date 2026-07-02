import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(fileURLToPath(import.meta.url), '..', '..', '..');
const tempDir = join(rootDir, 'tmp', 'commitlint');
const commitlintBin =
  process.platform === 'win32'
    ? join(rootDir, 'node_modules', '.bin', 'commitlint.CMD')
    : join(rootDir, 'node_modules', '.bin', 'commitlint');

function lintMessage(message) {
  const fileName = message.replace(/\W+/g, '-').toLowerCase() || 'message';
  const filePath = join(tempDir, `${fileName}.txt`);

  writeFileSync(filePath, `${message}\n`);
  execFileSync(commitlintBin, ['--edit', filePath], {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: 'pipe',
  });
}

rmSync(tempDir, { force: true, recursive: true });
mkdirSync(tempDir, { recursive: true });

const allowedTypes = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'fork',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
];

for (const type of allowedTypes) {
  const message = `${type}: validate ${type} commit type`;

  lintMessage(message);
}

let rejectedInvalidMessage = false;

try {
  lintMessage('update commit setup');
} catch {
  rejectedInvalidMessage = true;
}

if (!rejectedInvalidMessage) {
  throw new Error('commitlint should reject messages without a valid type');
}

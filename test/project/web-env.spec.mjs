import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import webEnv from '../../scripts/web-env.cjs';

const { getWebEnv, parseEnvFile } = webEnv;

assert.deepEqual(
  parseEnvFile(
    [
      '# local web settings',
      'WEB_HOST="localhost"',
      'WEB_PORT=4300',
      'INVALID_LINE',
      '=empty-key',
      '',
    ].join('\n'),
  ),
  {
    WEB_HOST: 'localhost',
    WEB_PORT: '4300',
  },
);

const envTestDir = mkdtempSync(join(tmpdir(), 'web-env-'));
try {
  const envFilePath = join(envTestDir, '.env');
  writeFileSync(envFilePath, 'WEB_HOST=127.0.0.1\nWEB_PORT=4200\n');

  assert.deepEqual(getWebEnv({ env: {}, envFilePath }), {
    baseURL: 'http://127.0.0.1:4200',
    host: '127.0.0.1',
    port: 4200,
  });

  assert.deepEqual(getWebEnv({ env: { WEB_PORT: '4300' }, envFilePath }), {
    baseURL: 'http://127.0.0.1:4300',
    host: '127.0.0.1',
    port: 4300,
  });

  assert.deepEqual(
    getWebEnv({
      env: { WEB_HOST: 'localhost', WEB_PORT: '4301' },
      envFilePath,
    }),
    {
      baseURL: 'http://localhost:4301',
      host: 'localhost',
      port: 4301,
    },
  );

  writeFileSync(envFilePath, 'WEB_HOST="localhost"\nWEB_PORT="4400"\n');
  assert.deepEqual(getWebEnv({ env: {}, envFilePath }), {
    baseURL: 'http://localhost:4400',
    host: 'localhost',
    port: 4400,
  });

  assert.deepEqual(
    getWebEnv({ env: {}, envFilePath: join(envTestDir, 'missing.env') }),
    {
      baseURL: 'http://127.0.0.1:4200',
      host: '127.0.0.1',
      port: 4200,
    },
  );

  assert.throws(
    () => getWebEnv({ env: { WEB_HOST: '' }, envFilePath }),
    /WEB_HOST must be a non-empty string/,
  );

  for (const WEB_PORT of ['', '0', '-1', 'abc', '4200.5', '65536']) {
    assert.throws(
      () => getWebEnv({ env: { WEB_PORT }, envFilePath }),
      /WEB_PORT must be a positive integer/,
    );
  }
} finally {
  rmSync(envTestDir, { force: true, recursive: true });
}

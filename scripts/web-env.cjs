const { existsSync, readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const defaultEnvPath = resolve(__dirname, '..', '.env');
const defaultWebHost = '127.0.0.1';
const defaultWebPort = 4200;

function parseEnvFile(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separatorIndex = line.indexOf('=');

        if (separatorIndex === -1) {
          return null;
        }

        const key = line.slice(0, separatorIndex).trim();
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, '');

        return key ? [key, value] : null;
      })
      .filter(Boolean),
  );
}

function getWebEnv(options = {}) {
  const envFilePath = options.envFilePath ?? defaultEnvPath;
  const fileEnv = existsSync(envFilePath)
    ? parseEnvFile(readFileSync(envFilePath, 'utf8'))
    : {};
  const env = {
    ...fileEnv,
    ...(options.env ?? process.env),
  };
  const port = Number(env.WEB_PORT ?? defaultWebPort);
  const host = env.WEB_HOST ?? defaultWebHost;

  if (typeof host !== 'string' || host.trim() === '') {
    throw new Error('WEB_HOST must be a non-empty string.');
  }

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`WEB_PORT must be a positive integer, received: ${port}`);
  }

  return {
    baseURL: `http://${host}:${port}`,
    host,
    port,
  };
}

module.exports = {
  getWebEnv,
  parseEnvFile,
};

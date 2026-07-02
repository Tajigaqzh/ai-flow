/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { AppModule } from './app/app.module';

const envPath = resolve(__dirname, '..', '..', '..', '.env');
const localEnvPath = resolve(__dirname, '..', '..', '..', '.env.local');

if (existsSync(envPath)) {
  loadEnvFile(envPath);
}

if (existsSync(localEnvPath)) {
  loadEnvFile(localEnvPath);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  const host = process.env.API_HOST ?? '127.0.0.1';
  const port = Number(process.env.API_PORT ?? process.env.PORT ?? 3000);

  await app.listen(port, host);
  Logger.log(
    `🚀 Application is running on: http://${host}:${port}/${globalPrefix}`,
  );
}

bootstrap();

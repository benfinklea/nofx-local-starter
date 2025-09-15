import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  await app.listen(3000);
  console.log('Control plane listening on http://localhost:3000');
}
bootstrap();

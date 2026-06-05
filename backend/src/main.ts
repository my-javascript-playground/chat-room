import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Allow the Next.js frontend to connect
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`Chat server running on http://localhost:${port}`);
}

bootstrap();

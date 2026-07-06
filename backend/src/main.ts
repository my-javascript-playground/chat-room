import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    process.env.FRONTEND_URL     ?? 'http://localhost:3000',  // Next.js
    process.env.FRONTEND_ANGULAR_URL ?? 'http://localhost', // Angular
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
  });

  const port = process.env.PORT ?? 8080;
  await app.listen(port);
  console.log(`Chat server running on http://localhost:${port}`);
}

bootstrap();

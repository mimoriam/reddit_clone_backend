import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import * as cookieParser from 'cookie-parser';
import { PrismaService } from './prisma.service';

async function bootstrap() {
  const app: INestApplication = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:3000'],
      credentials: true,
    },
  });
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('/api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      // disableErrorMessages: true,
      // forbidNonWhitelisted: true,
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.use(cookieParser());

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(configService.get('APP_PORT') || 3001);
}

bootstrap().then();

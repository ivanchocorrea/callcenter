import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    cors: false, // habilitamos CORS abajo con whitelist
  });

  app.useLogger(app.get(PinoLogger));

  // Seguridad
  app.use(
    helmet({
      contentSecurityPolicy: false, // configurable; el nginx lo refuerza
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());
  app.use(cookieParser());
  app.use(new RequestIdMiddleware().use);

  // CORS
  const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  // Global pipes / filters / interceptors
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.setGlobalPrefix('api', { exclude: ['/health/live', '/health/ready', '/metrics'] });

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Call Center NODOE API')
    .setDescription('API REST + WebSocket para el SaaS multiempresa de call center')
    .setVersion('0.1.0')
    .addBearerAuth()
    .addTag('auth')
    .addTag('companies')
    .addTag('users')
    .addTag('roles')
    .addTag('agents')
    .addTag('calls')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = parseInt(process.env.BACKEND_PORT ?? '3001', 10);
  await app.listen(port, process.env.BACKEND_HOST ?? '0.0.0.0');
  Logger.log(`🚀 Backend listening on :${port}`, 'Bootstrap');
  Logger.log(`📚 Swagger UI: http://localhost:${port}/api/docs`, 'Bootstrap');
}

bootstrap().catch(err => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

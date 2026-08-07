import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * The ecom-api entry point. Routes live under /api (e.g. GET /api/products).
 * nginx forwards /api/* here.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3008;

  // Prefix every route with /api, e.g. GET /api/products.
  app.setGlobalPrefix('api');

  // Parse the Cookie header so the JwtAuthGuard can read the HttpOnly auth
  // cookie (req.cookies['access_token']) set by the auth service.
  app.use(cookieParser());

  // Validate/transform incoming request bodies against the DTO classes.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in the DTO
      forbidNonWhitelisted: true, // reject requests with unknown properties
      transform: true, // convert payloads to their DTO class instances
    }),
  );

  // Consistent success envelope + error shape across the platform.
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  // `credentials: true` + reflecting the request origin is required for the
  // browser to send the auth cookie on cross-origin requests. Same-origin
  // (through nginx) works regardless.
  app.enableCors({ origin: true, credentials: true });

  // `0.0.0.0` is important inside Docker so the port is reachable from nginx.
  await app.listen(port, '0.0.0.0');
  Logger.log(`🛒 ecom-api running on http://localhost:${port}/api`);
}

bootstrap();

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

/**
 * Entry point for the auth service.
 *
 * NOTE: unlike the ecom-api, this service does NOT set a global `/api` prefix.
 * Its routes are /auth/*, /health, and /.well-known/jwks.json — nginx routes
 * /auth and /.well-known here (see docker/nginx/nginx.conf).
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3009;

  // Behind nginx, the socket IP is nginx's. Trust the first proxy hop so
  // `req.ip` reflects the real client (X-Forwarded-For) — used for rate limits.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // Security headers (HSTS, X-Content-Type-Options, etc.). It's a JSON API, so
  // the default CSP isn't needed and would only complicate the JWKS response.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Parse the Cookie header so JwtAuthGuard can read the HttpOnly auth cookie.
  app.use(cookieParser());

  // CORS for browser frontends on other origins. An empty allowlist reflects
  // the request origin (dev); set CORS_ORIGINS in prod. credentials:true lets
  // the browser send the HttpOnly auth cookie cross-origin.
  const corsOrigins = config.get<string[]>('cors.origins') ?? [];
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
  });

  // Validate incoming DTOs; strip/reject unknown properties.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent success envelope (except @Raw() handlers like JWKS) and errors.
  app.useGlobalInterceptors(new TransformInterceptor(app.get(Reflector)));
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.listen(port, '0.0.0.0');
  Logger.log(`🔐 auth-service running on http://localhost:${port}`);
}

bootstrap();

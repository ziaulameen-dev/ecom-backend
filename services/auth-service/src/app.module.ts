import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { ConditionalThrottlerGuard } from './common/guards/conditional-throttler.guard';
import { HealthModule } from './health/health.module';
import { JwksModule } from './jwks/jwks.module';
import { KeysModule } from './keys/keys.module';
import { LoginOtp } from './otp/login-otp.entity';
import { User } from './users/user.entity';

/**
 * Root module for the auth service.
 *
 * `TypeOrmModule.forRootAsync` connects to THIS service's own Postgres using
 * values from ConfigService. `synchronize: true` auto-creates tables from the
 * entities on boot — convenient for dev. In production you would turn this off
 * and use migrations instead (see docs).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.username'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.database'),
        entities: [User, LoginOtp],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        // Retry a few times so the app can start before Postgres is fully ready.
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    // Global default: 100 requests / 60s per IP. Per-route @Throttle() on the
    // auth endpoints tightens this. Only enforced when RATE_LIMIT_ENABLED=true
    // (see ConditionalThrottlerGuard).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    KeysModule,
    JwksModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ConditionalThrottlerGuard }],
})
export class AppModule {}

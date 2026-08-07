import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CsrfGuard } from './common/guards/csrf.guard';
import configuration from './config/configuration';
import { HealthModule } from './health/health.module';
import { Product } from './products/product.entity';
import { ProductsModule } from './products/products.module';
import { ProfileModule } from './profile/profile.module';

/**
 * Root module for the ecom-api.
 *
 * `TypeOrmModule.forRootAsync` connects to THIS service's own Postgres
 * (separate from the auth service's DB). `synchronize: true` auto-creates
 * tables from entities in dev; use migrations in production.
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
        entities: [Product],
        synchronize: config.get<string>('nodeEnv') !== 'production',
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    HealthModule,
    ProductsModule,
    ProfileModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}

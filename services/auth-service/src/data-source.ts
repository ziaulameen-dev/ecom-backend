import { DataSource } from 'typeorm';
import { AuditLog } from './audit/audit-log.entity';
import { LoginOtp } from './otp/login-otp.entity';
import { RefreshToken } from './refresh/refresh-token.entity';
import { User } from './users/user.entity';

/**
 * Standalone TypeORM DataSource for the migration CLI (outside the Nest app).
 * Dev uses `synchronize` (see app.module.ts) so you rarely touch this; in
 * PRODUCTION turn synchronize off and run `npm run migration:run` on deploy.
 *
 * Reads the same AUTH_DB_* env as the app. To generate against an empty DB from
 * the host, point AUTH_DB_HOST/PORT at the published Postgres (localhost:5442).
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.AUTH_DB_HOST ?? 'localhost',
  port: parseInt(process.env.AUTH_DB_PORT ?? '5432', 10),
  username: process.env.AUTH_DB_USER ?? 'auth',
  password: process.env.AUTH_DB_PASSWORD ?? 'auth',
  database: process.env.AUTH_DB_NAME ?? 'authdb',
  entities: [User, LoginOtp, RefreshToken, AuditLog],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});

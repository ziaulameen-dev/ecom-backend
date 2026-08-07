import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

/** Optional profile fields captured at signup (all optional). */
export interface UserProfile {
  name?: string;
  mobile?: string;
}

/**
 * User store backed by the auth service's OWN Postgres database (via TypeORM).
 * Only this service can read/write these rows — the ecom-api has no access to
 * this database, which is the whole point of database-per-service.
 *
 * Auth is passwordless: there are no credentials here, just the account record.
 */
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Seed a demo admin so you can log in immediately after boot (OTP only). */
  async onModuleInit() {
    const email = 'admin@example.com';
    if (!(await this.findByEmail(email))) {
      await this.create(email, ['admin'], { name: 'Admin' });
      this.logger.log(`Seeded demo user: ${email} (passwordless — sign in with an OTP)`);
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: email.toLowerCase() } });
  }

  /** Create a new account. No password — identity is proven via OTP. */
  create(
    email: string,
    roles: string[] = ['customer'],
    profile: UserProfile = {},
  ): Promise<User> {
    const user = this.users.create({
      email: email.toLowerCase(),
      name: profile.name ?? null,
      mobile: profile.mobile ?? null,
      roles,
    });
    return this.users.save(user);
  }
}

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
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

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  /** Update the optional profile fields. Only provided keys are changed. */
  async updateProfile(id: string, profile: UserProfile): Promise<User> {
    const user = await this.mustFind(id);
    if (profile.name !== undefined) user.name = profile.name ?? null;
    if (profile.mobile !== undefined) user.mobile = profile.mobile ?? null;
    return this.users.save(user);
  }

  /** Record the target address while an email change is in progress. */
  async setPendingEmail(id: string, pendingEmail: string | null): Promise<User> {
    const user = await this.mustFind(id);
    user.pendingEmail = pendingEmail ? pendingEmail.toLowerCase() : null;
    return this.users.save(user);
  }

  /**
   * Change the account's email (its login identifier) and clear any pending
   * change. Rejects if the new address is already taken by another account.
   */
  async updateEmail(id: string, newEmail: string): Promise<User> {
    const normalized = newEmail.toLowerCase();
    const existing = await this.findByEmail(normalized);
    if (existing && existing.id !== id) {
      throw new ConflictException('Email already in use');
    }
    const user = await this.mustFind(id);
    user.email = normalized;
    user.pendingEmail = null;
    return this.users.save(user);
  }

  /**
   * Soft-delete (deactivate) the account: retain the row and its history, but
   * free the real email for re-signup by moving it to `deletedEmail` and
   * parking a unique tombstone in `email`. Live PII is cleared.
   */
  async softDelete(id: string): Promise<void> {
    const user = await this.mustFind(id);
    user.deletedEmail = user.email;
    user.email = `deleted+${user.id}@account.invalid`; // unique, non-routable
    user.name = null;
    user.mobile = null;
    user.pendingEmail = null;
    user.deletedAt = new Date();
    await this.users.save(user);
  }

  private async mustFind(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
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

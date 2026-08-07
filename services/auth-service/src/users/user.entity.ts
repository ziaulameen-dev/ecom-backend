import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A registered user, persisted in the auth service's OWN Postgres database.
 *
 * Auth is fully PASSWORDLESS — there is no password hash. A user proves
 * ownership of their email by verifying a one-time code (OTP). Accounts are
 * created lazily the first time an email verifies an OTP, so the profile fields
 * below are all optional and can be filled in later.
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  // Optional profile — collected at signup (all optional) or edited later.
  // Country is deliberately NOT stored here; it lives on the shipping address
  // captured at checkout.
  @Column({ type: 'varchar', nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', nullable: true })
  mobile!: string | null;

  // Set while an email change is in progress (the target address). Cleared
  // once the change completes. See the /auth/email/* flow.
  @Column({ name: 'pending_email', type: 'varchar', nullable: true })
  pendingEmail!: string | null;

  // Stored as a Postgres text[] column, e.g. {admin,customer}.
  @Column('text', { array: true, default: '{customer}' })
  roles!: string[];

  // Soft delete (deactivation). When set, the account is gone: `email` holds a
  // unique tombstone so the REAL address is freed for re-signup, and the
  // original is preserved in `deletedEmail` for records. See /auth/account/*.
  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_email', type: 'varchar', nullable: true })
  deletedEmail!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

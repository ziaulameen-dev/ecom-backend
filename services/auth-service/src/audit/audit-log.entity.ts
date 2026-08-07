import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * An append-only record of a security-sensitive action (login, email change,
 * account deletion, logout-all). Useful for support, abuse investigation, and
 * "recent activity" views. Never mutated after insert.
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  // A short machine-readable action key, e.g. 'login', 'email_changed'.
  @Column()
  action!: string;

  // Free-form context (e.g. { from, to } for an email change). No secrets.
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

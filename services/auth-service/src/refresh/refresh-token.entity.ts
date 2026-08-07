import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A long-lived refresh token, persisted so it can be ROTATED (single-use) and
 * REVOKED (logout / logout-all). Only the SHA-256 hash of the opaque token is
 * stored — a DB leak never exposes usable tokens.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  // Set when the token is rotated (on refresh) or revoked (on logout).
  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

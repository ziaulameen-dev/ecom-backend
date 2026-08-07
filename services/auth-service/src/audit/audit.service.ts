import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

/** Known audit action keys (kept as a union for consistency). */
export type AuditAction =
  | 'login'
  | 'email_changed'
  | 'account_deleted'
  | 'logout_all'
  | 'refresh_reuse';

/**
 * Writes append-only audit records. Failures are swallowed (logged) so that an
 * audit write can never break the user-facing action it describes.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  async record(
    userId: string | null,
    action: AuditAction,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.logs.save(
        this.logs.create({ userId, action, metadata: metadata ?? null }),
      );
    } catch (err) {
      this.logger.warn(`Failed to write audit '${action}': ${String(err)}`);
    }
  }
}

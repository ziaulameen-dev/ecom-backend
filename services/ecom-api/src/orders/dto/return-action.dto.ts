import { IsIn } from 'class-validator';

/** Validated body for PATCH /api/admin/returns/:id. */
export class ReturnActionDto {
  @IsIn(['approve', 'reject', 'receive'])
  action!: 'approve' | 'reject' | 'receive';
}

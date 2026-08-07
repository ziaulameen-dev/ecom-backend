import { IsIn } from 'class-validator';

/** Validated body for PATCH /api/admin/returns/:id. */
export class ReturnActionDto {
  @IsIn(['approve', 'reject', 'receive', 'refund'])
  action!: 'approve' | 'reject' | 'receive' | 'refund';
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A product review. For now these are created by admins (curated), but the shape
 * supports customer-authored reviews later (add a userId + moderation flow).
 */
@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  // 1..5
  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'varchar', nullable: true })
  title!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'author_name' })
  authorName!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

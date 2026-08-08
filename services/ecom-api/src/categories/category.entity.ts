import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A catalog category. Two levels via self-reference: a top category (Watch,
 * Perfume) has `parentId = null`; a subcategory (Men, Women, Unisex) points to
 * its parent. Products attach to a LEAF category (usually a subcategory).
 */
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column()
  slug!: string;

  // Null for a top-level category; set for a subcategory.
  @Index()
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

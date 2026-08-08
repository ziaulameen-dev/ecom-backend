import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductVariant } from './product-variant.entity';

/**
 * A product, persisted in the ecom-api's OWN Postgres database (India / INR).
 *
 * `priceMinor`/`stock` are the BASE values for a simple product with no
 * variants. When a product has variants, price/stock come from the selected
 * variant instead (see ProductVariant).
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  slug!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl!: string | null;

  // Legacy free-text tag; the real taxonomy is `categoryId`.
  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Index()
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ default: true })
  active!: boolean;

  @Column({ default: 0 })
  stock!: number;

  // Base INR price in the smallest unit (paise).
  @Column({ name: 'price_minor', type: 'int', default: 0 })
  priceMinor!: number;

  @OneToMany(() => ProductVariant, (v) => v.product, { cascade: true })
  variants!: ProductVariant[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Product } from './product.entity';

/**
 * A concrete purchasable variant of a product — one combination of attribute
 * values (e.g. Color=Black + Strap=Steel), with its OWN price, stock and images.
 *
 * `valueIds` holds the AttributeValue ids that define this variant.
 * `listedSeparately` decides whether it shows as its own card on the product
 * listing page, or only inside the parent product.
 */
@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  @ManyToOne(() => Product, (p) => p.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product!: Product;

  // Optional human SKU.
  @Column({ type: 'varchar', nullable: true })
  sku!: string | null;

  @Column({ name: 'price_minor', type: 'int', default: 0 })
  priceMinor!: number;

  @Column({ type: 'int', default: 0 })
  stock!: number;

  // AttributeValue ids that make up this variant (e.g. [blackId, steelId]).
  @Column({ name: 'value_ids', type: 'jsonb', default: () => "'[]'" })
  valueIds!: string[];

  // MinIO object keys for this variant's images.
  @Column({ type: 'jsonb', default: () => "'[]'" })
  images!: string[];

  // Show as its own card on the listing page, or only inside the parent product.
  @Column({ name: 'listed_separately', type: 'boolean', default: false })
  listedSeparately!: boolean;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

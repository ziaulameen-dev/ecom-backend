import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * A product, persisted in the ecom-api's OWN Postgres database.
 *
 * India-only store: a single INR price lives on the product itself
 * (`priceMinor`, in paise).
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl!: string | null;

  @Column({ type: 'varchar', nullable: true })
  category!: string | null;

  @Column({ default: 0 })
  stock!: number;

  // INR price in the smallest unit (paise).
  @Column({ name: 'price_minor', type: 'int', default: 0 })
  priceMinor!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

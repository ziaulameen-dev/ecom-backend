import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A product, persisted in the ecom-api's OWN Postgres database. */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  // Stored in the smallest currency unit (e.g. cents) to avoid float rounding.
  @Column('int')
  priceCents!: number;

  @Column({ default: 0 })
  stock!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

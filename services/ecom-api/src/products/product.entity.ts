import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductPrice } from './product-price.entity';

/**
 * A product, persisted in the ecom-api's OWN Postgres database.
 *
 * Price is NOT on the product — it's per country (see ProductPrice), because
 * this is a global store where admins set prices per market/currency.
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ default: 0 })
  stock!: number;

  @OneToMany(() => ProductPrice, (p) => p.product)
  prices!: ProductPrice[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

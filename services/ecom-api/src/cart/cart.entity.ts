import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CartItem } from './cart-item.entity';

/**
 * A shopping cart. It belongs to EITHER a logged-in user (`userId`) or a guest
 * (identified by the cart's own id in the `cart_id` cookie). On login the guest
 * cart is merged into the user's cart.
 *
 * `country` drives which per-country product prices (and currency) apply.
 */
@Entity('carts')
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  // ISO 3166-1 alpha-2 (uppercase). Determines pricing + currency.
  @Column({ type: 'varchar', length: 2, default: 'IN' })
  country!: string;

  @OneToMany(() => CartItem, (i) => i.cart, { cascade: true })
  items!: CartItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

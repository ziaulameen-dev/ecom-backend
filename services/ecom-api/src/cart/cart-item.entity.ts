import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Cart } from './cart.entity';

/**
 * A line in a cart: a product (+ optional variant) + quantity. PRICE/stock are
 * NOT stored here — resolved live from the variant (or base product) at
 * view/checkout time, so changes are always reflected. (The order snapshots
 * price.) A product with variants has one line per chosen variant.
 */
@Entity('cart_items')
@Unique(['cartId', 'productId', 'variantId'])
export class CartItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'cart_id', type: 'uuid' })
  cartId!: string;

  @ManyToOne(() => Cart, (c) => c.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart!: Cart;

  @Column({ name: 'product_id', type: 'uuid' })
  productId!: string;

  // Null for a simple product with no variants; set to the chosen variant id.
  @Column({ name: 'variant_id', type: 'uuid', nullable: true })
  variantId!: string | null;

  @Column({ type: 'int' })
  quantity!: number;
}

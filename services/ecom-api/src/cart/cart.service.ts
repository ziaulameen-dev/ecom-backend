import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { CartItem } from './cart-item.entity';
import { Cart } from './cart.entity';

/** A cart line (India / INR). */
export interface CartLineView {
  productId: string;
  name: string;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  available: boolean; // product still exists
  stock: number;
}

/** A cart shaped for display / checkout. */
export interface CartView {
  id: string;
  currency: string;
  items: CartLineView[];
  itemCount: number;
  subtotalMinor: number;
}

/** Who is asking for a cart. */
export interface CartOwner {
  userId: string | null;
  cookieCartId: string | null;
}

/** INR is the only currency (India-only store). */
const CURRENCY = 'inr';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    private readonly products: ProductsService,
  ) {}

  /**
   * Find the caller's cart (a logged-in user's cart by userId, else the guest
   * cart from the cookie), creating one if needed. Returns the cart and whether
   * it was just created (so the controller can set the cookie).
   */
  async resolveOrCreate(
    owner: CartOwner,
  ): Promise<{ cart: Cart; created: boolean }> {
    if (owner.userId) {
      const existing = await this.carts.findOne({
        where: { userId: owner.userId },
      });
      if (existing) return { cart: existing, created: false };
      return { cart: await this.create(owner.userId), created: true };
    }

    if (owner.cookieCartId) {
      const guest = await this.carts.findOne({
        where: { id: owner.cookieCartId, userId: IsNull() },
      });
      if (guest) return { cart: guest, created: false };
    }
    return { cart: await this.create(null), created: true };
  }

  /**
   * Merge a guest cart (from the cookie) into the user's cart on login: add
   * each guest line (summing quantities, capping at stock), then delete the
   * guest cart.
   */
  async merge(userId: string, guestCartId: string | null): Promise<Cart> {
    const { cart: userCart } = await this.resolveOrCreate({
      userId,
      cookieCartId: null,
    });
    if (!guestCartId) return userCart;

    const guest = await this.carts.findOne({
      where: { id: guestCartId, userId: IsNull() },
    });
    if (!guest || guest.id === userCart.id) return userCart;

    const guestItems = await this.items.find({ where: { cartId: guest.id } });
    for (const item of guestItems) {
      try {
        await this.addItem(userCart, item.productId, item.quantity);
      } catch {
        // Skip items that no longer exist.
      }
    }

    await this.carts.delete({ id: guest.id }); // items cascade
    return userCart;
  }

  async addItem(cart: Cart, productId: string, quantity: number): Promise<void> {
    const product = await this.products.findEntity(productId);
    if (!product) throw new NotFoundException('Product not found');

    const existing = await this.items.findOne({
      where: { cartId: cart.id, productId },
    });
    const desired = (existing?.quantity ?? 0) + quantity;
    const capped = Math.min(Math.max(desired, 0), product.stock);
    await this.upsertQuantity(cart, productId, capped, existing ?? undefined);
  }

  async setItemQuantity(
    cart: Cart,
    productId: string,
    quantity: number,
  ): Promise<void> {
    const existing = await this.items.findOne({
      where: { cartId: cart.id, productId },
    });
    if (!existing && quantity <= 0) return;
    const product = await this.products.findEntity(productId);
    if (!product) throw new NotFoundException('Product not found');
    const capped = Math.min(Math.max(quantity, 0), product.stock);
    await this.upsertQuantity(cart, productId, capped, existing ?? undefined);
  }

  async removeItem(cart: Cart, productId: string): Promise<void> {
    await this.items.delete({ cartId: cart.id, productId });
  }

  async clear(cart: Cart): Promise<void> {
    await this.items.delete({ cartId: cart.id });
  }

  /** Build the priced view of a cart (INR). */
  async view(cart: Cart): Promise<CartView> {
    const rows = await this.items.find({
      where: { cartId: cart.id },
      order: { id: 'ASC' },
    });

    const lines: CartLineView[] = [];
    let subtotal = 0;

    for (const row of rows) {
      const product = await this.products.findEntity(row.productId);
      const unit = product?.priceMinor ?? 0;
      const lineTotal = unit * row.quantity;
      subtotal += lineTotal;
      lines.push({
        productId: row.productId,
        name: product?.name ?? '(removed)',
        quantity: row.quantity,
        unitAmountMinor: unit,
        lineTotalMinor: lineTotal,
        available: product != null,
        stock: product?.stock ?? 0,
      });
    }

    return {
      id: cart.id,
      currency: CURRENCY,
      items: lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      subtotalMinor: subtotal,
    };
  }

  /** Delete abandoned GUEST carts not touched since the cutoff. Returns count. */
  async purgeAbandonedGuestCarts(olderThan: Date): Promise<number> {
    const stale = await this.carts.find({
      where: { userId: IsNull(), updatedAt: LessThan(olderThan) },
    });
    if (!stale.length) return 0;
    await this.carts.remove(stale); // cascades to items
    return stale.length;
  }

  private create(userId: string | null): Promise<Cart> {
    return this.carts.save(this.carts.create({ userId }));
  }

  private async upsertQuantity(
    cart: Cart,
    productId: string,
    quantity: number,
    existing?: CartItem,
  ): Promise<void> {
    if (quantity <= 0) {
      if (existing) await this.items.delete({ id: existing.id });
      return;
    }
    const row = existing ?? this.items.create({ cartId: cart.id, productId });
    row.quantity = quantity;
    await this.items.save(row);
  }
}

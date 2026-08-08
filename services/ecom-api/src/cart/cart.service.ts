import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { CartItem } from './cart-item.entity';
import { Cart } from './cart.entity';

/** A cart line (India / INR). One line per product+variant combination. */
export interface CartLineView {
  id: string; // cart_item id (used to update/remove)
  productId: string;
  variantId: string | null;
  name: string;
  label: string | null; // variant options, e.g. "Black / Steel"
  imageUrl: string | null;
  quantity: number;
  unitAmountMinor: number;
  lineTotalMinor: number;
  available: boolean;
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

/** Guard against malformed X-Cart-Id headers (avoids a Postgres uuid cast 500). */
const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    private readonly products: ProductsService,
  ) {}

  /**
   * Find the caller's cart (a logged-in user's cart by userId, else the guest
   * cart from the cookie), creating one if needed.
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

    if (owner.cookieCartId && isUuid(owner.cookieCartId)) {
      const guest = await this.carts.findOne({
        where: { id: owner.cookieCartId, userId: IsNull() },
      });
      if (guest) return { cart: guest, created: false };
    }
    return { cart: await this.create(null), created: true };
  }

  /** Merge a guest cart into the user's cart on login. */
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
        await this.addItem(userCart, item.productId, item.variantId, item.quantity);
      } catch {
        // Skip items that no longer exist / are invalid.
      }
    }

    await this.carts.delete({ id: guest.id }); // items cascade
    return userCart;
  }

  /**
   * Add a product (with optional variant) to the cart. A product that HAS
   * variants requires a variantId; a simple product must not carry one.
   */
  async addItem(
    cart: Cart,
    productId: string,
    variantId: string | null,
    quantity: number,
  ): Promise<void> {
    const hasVariants = (await this.products.variantCount(productId)) > 0;
    if (hasVariants && !variantId) {
      throw new BadRequestException('Please select a variant');
    }
    if (!hasVariants) variantId = null;

    const line = await this.products.resolveLine(productId, variantId);
    if (!line || !line.available) {
      throw new BadRequestException('Product is not available');
    }

    const existing = await this.findLine(cart.id, productId, variantId);
    const desired = (existing?.quantity ?? 0) + quantity;
    const capped = Math.min(Math.max(desired, 0), line.stock);
    await this.upsertQuantity(cart, productId, variantId, capped, existing);
  }

  /** Set a line's quantity by its cart_item id. */
  async setItemQuantity(cart: Cart, itemId: string, quantity: number): Promise<void> {
    const existing = await this.items.findOne({ where: { id: itemId, cartId: cart.id } });
    if (!existing) return;
    const line = await this.products.resolveLine(existing.productId, existing.variantId);
    const capped = Math.min(Math.max(quantity, 0), line?.stock ?? 0);
    await this.upsertQuantity(cart, existing.productId, existing.variantId, capped, existing);
  }

  async removeItem(cart: Cart, itemId: string): Promise<void> {
    await this.items.delete({ id: itemId, cartId: cart.id });
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
      const line = await this.products.resolveLine(row.productId, row.variantId);
      const unit = line?.unitAmountMinor ?? 0;
      const lineTotal = unit * row.quantity;
      subtotal += lineTotal;
      lines.push({
        id: row.id,
        productId: row.productId,
        variantId: row.variantId,
        name: line?.name ?? '(removed)',
        label: line?.label ?? null,
        imageUrl: line?.imageUrl ?? null,
        quantity: row.quantity,
        unitAmountMinor: unit,
        lineTotalMinor: lineTotal,
        available: !!line?.available,
        stock: line?.stock ?? 0,
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

  private findLine(
    cartId: string,
    productId: string,
    variantId: string | null,
  ): Promise<CartItem | null> {
    return this.items.findOne({
      where: { cartId, productId, variantId: variantId ?? IsNull() },
    });
  }

  private async upsertQuantity(
    cart: Cart,
    productId: string,
    variantId: string | null,
    quantity: number,
    existing?: CartItem | null,
  ): Promise<void> {
    if (quantity <= 0) {
      if (existing) await this.items.delete({ id: existing.id });
      return;
    }
    const row =
      existing ?? this.items.create({ cartId: cart.id, productId, variantId });
    row.quantity = quantity;
    await this.items.save(row);
  }
}

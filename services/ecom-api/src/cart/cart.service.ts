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

/** A cart line resolved for the cart's country. */
export interface CartLineView {
  productId: string;
  name: string;
  quantity: number;
  unitAmountMinor: number | null; // null if not priced in this country
  lineTotalMinor: number;
  available: boolean; // priced in this country
  stock: number;
}

/** A cart shaped for display / checkout. */
export interface CartView {
  id: string;
  country: string;
  currency: string | null;
  items: CartLineView[];
  itemCount: number;
  subtotalMinor: number;
}

/** Who is asking for a cart. */
export interface CartOwner {
  userId: string | null;
  cookieCartId: string | null;
}

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
    country?: string,
  ): Promise<{ cart: Cart; created: boolean }> {
    if (owner.userId) {
      const existing = await this.carts.findOne({
        where: { userId: owner.userId },
      });
      if (existing) return { cart: existing, created: false };
      return { cart: await this.create(owner.userId, country), created: true };
    }

    if (owner.cookieCartId) {
      const guest = await this.carts.findOne({
        where: { id: owner.cookieCartId, userId: IsNull() },
      });
      if (guest) return { cart: guest, created: false };
    }
    return { cart: await this.create(null, country), created: true };
  }

  /**
   * Merge a guest cart (from the cookie) into the user's cart on login: add
   * each guest line (summing quantities, capping at stock), then delete the
   * guest cart. Unpriced-in-country lines are skipped rather than failing.
   */
  async merge(userId: string, guestCartId: string | null): Promise<Cart> {
    const { cart: userCart, created } = await this.resolveOrCreate({
      userId,
      cookieCartId: null,
    });
    if (!guestCartId) return userCart;

    const guest = await this.carts.findOne({
      where: { id: guestCartId, userId: IsNull() },
    });
    if (!guest || guest.id === userCart.id) return userCart;

    // A brand-new user cart adopts the country the guest was shopping in.
    if (created && userCart.country !== guest.country) {
      userCart.country = guest.country;
      await this.carts.save(userCart);
    }

    const guestItems = await this.items.find({ where: { cartId: guest.id } });
    for (const item of guestItems) {
      try {
        await this.addItem(userCart, item.productId, item.quantity);
      } catch {
        // Skip items not available in the user cart's country.
      }
    }

    await this.carts.delete({ id: guest.id }); // items cascade
    return userCart;
  }

  /** Change the cart's country (re-prices everything on next view). */
  async setCountry(cart: Cart, country: string): Promise<Cart> {
    cart.country = country.toUpperCase();
    return this.carts.save(cart);
  }

  async addItem(cart: Cart, productId: string, quantity: number): Promise<void> {
    const product = await this.products.findEntity(productId);
    if (!product) throw new NotFoundException('Product not found');
    const price = await this.products.priceFor(productId, cart.country);
    if (!price) {
      throw new BadRequestException(
        `Product is not available in ${cart.country}`,
      );
    }

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

  /** Build the priced view of a cart for its country. */
  async view(cart: Cart): Promise<CartView> {
    const rows = await this.items.find({
      where: { cartId: cart.id },
      order: { id: 'ASC' },
    });

    const lines: CartLineView[] = [];
    let subtotal = 0;
    let currency: string | null = null;

    for (const row of rows) {
      const product = await this.products.findEntity(row.productId);
      const price = await this.products.priceFor(row.productId, cart.country);
      if (price && !currency) currency = price.currency;
      const unit = price?.amountMinor ?? null;
      const lineTotal = unit != null ? unit * row.quantity : 0;
      subtotal += lineTotal;
      lines.push({
        productId: row.productId,
        name: product?.name ?? '(removed)',
        quantity: row.quantity,
        unitAmountMinor: unit,
        lineTotalMinor: lineTotal,
        available: price != null && product != null,
        stock: product?.stock ?? 0,
      });
    }

    return {
      id: cart.id,
      country: cart.country,
      currency,
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

  private create(userId: string | null, country?: string): Promise<Cart> {
    return this.carts.save(
      this.carts.create({
        userId,
        country: (country ?? 'US').toUpperCase(),
      }),
    );
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

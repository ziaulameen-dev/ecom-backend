import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { SetPriceDto } from './dto/set-price.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductPrice } from './product-price.entity';
import { Product } from './product.entity';

/** A product shaped for a specific country (its price there, or null). */
export interface ProductView {
  id: string;
  name: string;
  stock: number;
  price: { currency: string; amountMinor: number } | null;
}

/**
 * Product business logic. Prices are per country (ProductPrice); the public
 * catalog is always resolved for a given destination country.
 */
@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductPrice)
    private readonly prices: Repository<ProductPrice>,
  ) {}

  /** Seed demo products + prices (US/IN/GB) on first boot. */
  async onModuleInit() {
    if ((await this.products.count()) > 0) return;
    const tee = await this.products.save(
      this.products.create({ name: 'T-Shirt', stock: 100 }),
    );
    const shoes = await this.products.save(
      this.products.create({ name: 'Sneakers', stock: 25 }),
    );
    await this.prices.save([
      this.prices.create({ productId: tee.id, country: 'US', currency: 'usd', amountMinor: 1999 }),
      this.prices.create({ productId: tee.id, country: 'IN', currency: 'inr', amountMinor: 49900 }),
      this.prices.create({ productId: tee.id, country: 'GB', currency: 'gbp', amountMinor: 1599 }),
      this.prices.create({ productId: shoes.id, country: 'US', currency: 'usd', amountMinor: 8999 }),
      this.prices.create({ productId: shoes.id, country: 'IN', currency: 'inr', amountMinor: 749900 }),
    ]);
    this.logger.log('Seeded demo products + per-country prices');
  }

  // ---- Public catalog -------------------------------------------------------

  /** List products with each one's price for the given country (null if none). */
  async findAllForCountry(country: string): Promise<ProductView[]> {
    const cc = country.toUpperCase();
    const products = await this.products.find({ order: { createdAt: 'DESC' } });
    const prices = await this.prices.find({ where: { country: cc } });
    const byProduct = new Map(prices.map((p) => [p.productId, p]));
    return products.map((p) => this.toView(p, byProduct.get(p.id)));
  }

  /** Resolve one product + its price for a country. Throws if the product is gone. */
  async findOneForCountry(id: string, country: string): Promise<ProductView> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    const price = await this.prices.findOne({
      where: { productId: id, country: country.toUpperCase() },
    });
    return this.toView(product, price ?? undefined);
  }

  /** The raw price row for a country (used by cart/checkout). */
  priceFor(productId: string, country: string): Promise<ProductPrice | null> {
    return this.prices.findOne({
      where: { productId, country: country.toUpperCase() },
    });
  }

  /** The raw product row (used by cart/checkout for name + stock). */
  findEntity(id: string): Promise<Product | null> {
    return this.products.findOne({ where: { id } });
  }

  /**
   * Atomically decrement stock only if enough is available. Returns true on
   * success — the `stock >= qty` guard in SQL prevents overselling under
   * concurrency (two buyers racing for the last unit).
   */
  async decrementStock(productId: string, qty: number): Promise<boolean> {
    const res = await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock - ${qty}` })
      .where('id = :id AND stock >= :qty', { id: productId, qty })
      .execute();
    return (res.affected ?? 0) > 0;
  }

  /** Add stock back (on cancel / refund / accepted return). */
  async incrementStock(productId: string, qty: number): Promise<void> {
    await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock + ${qty}` })
      .where('id = :id', { id: productId })
      .execute();
  }

  // ---- Admin: products ------------------------------------------------------

  create(dto: CreateProductDto): Promise<Product> {
    return this.products.save(this.products.create(dto));
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.mustFind(id);
    Object.assign(product, dto);
    return this.products.save(product);
  }

  async remove(id: string): Promise<void> {
    const res = await this.products.delete(id);
    if (!res.affected) throw new NotFoundException('Product not found');
  }

  // ---- Admin: per-country prices --------------------------------------------

  /** Upsert the price for (product, country). */
  async setPrice(productId: string, dto: SetPriceDto): Promise<ProductPrice> {
    await this.mustFind(productId);
    const country = dto.country.toUpperCase();
    const currency = dto.currency.toLowerCase();
    const existing = await this.prices.findOne({ where: { productId, country } });
    const row = existing ?? this.prices.create({ productId, country });
    row.currency = currency;
    row.amountMinor = dto.amountMinor;
    return this.prices.save(row);
  }

  async listPrices(productId: string): Promise<ProductPrice[]> {
    await this.mustFind(productId);
    return this.prices.find({ where: { productId }, order: { country: 'ASC' } });
  }

  async deletePrice(productId: string, country: string): Promise<void> {
    const res = await this.prices.delete({
      productId,
      country: country.toUpperCase(),
    });
    if (!res.affected) throw new NotFoundException('Price not found');
  }

  private async mustFind(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private toView(product: Product, price?: ProductPrice): ProductView {
    return {
      id: product.id,
      name: product.name,
      stock: product.stock,
      price: price
        ? { currency: price.currency, amountMinor: price.amountMinor }
        : null,
    };
  }
}

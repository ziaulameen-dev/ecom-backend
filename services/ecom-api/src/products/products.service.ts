import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.entity';

/** A product shaped for the storefront (India / INR). */
export interface ProductView {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string | null;
  stock: number;
  price: { currency: string; amountMinor: number };
}

/** Catalog filters. */
export interface CatalogQuery {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

/** INR is the only currency (India-only store). */
const CURRENCY = 'inr';

/** Product business logic. Every product carries a single INR price. */
@Injectable()
export class ProductsService implements OnModuleInit {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
  ) {}

  /** Seed demo products (INR) on first boot. */
  async onModuleInit() {
    if ((await this.products.count()) > 0) return;
    await this.products.save([
      this.products.create({
        name: 'T-Shirt',
        description: 'Soft 100% cotton tee.',
        category: 'apparel',
        imageUrl: 'https://placehold.co/600x400?text=T-Shirt',
        stock: 100,
        priceMinor: 49900,
      }),
      this.products.create({
        name: 'Sneakers',
        description: 'Everyday cushioned sneakers.',
        category: 'footwear',
        imageUrl: 'https://placehold.co/600x400?text=Sneakers',
        stock: 25,
        priceMinor: 749900,
      }),
    ]);
    this.logger.log('Seeded demo products');
  }

  // ---- Public catalog -------------------------------------------------------

  /** List products (with search/category filters). */
  async findAll(q: CatalogQuery = {}): Promise<ProductView[]> {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 100);
    const page = Math.max(q.page ?? 1, 1);

    const qb = this.products
      .createQueryBuilder('p')
      .orderBy('p.created_at', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);
    if (q.search) qb.andWhere('p.name ILIKE :s', { s: `%${q.search}%` });
    if (q.category) qb.andWhere('p.category = :c', { c: q.category });

    const products = await qb.getMany();
    return products.map((p) => this.toView(p));
  }

  /** Resolve one product. Throws if the product is gone. */
  async findOne(id: string): Promise<ProductView> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return this.toView(product);
  }

  /** The raw product row (used by cart/checkout for name, price + stock). */
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

  private async mustFind(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private toView(product: Product): ProductView {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      imageUrl: product.imageUrl,
      category: product.category,
      stock: product.stock,
      price: { currency: CURRENCY, amountMinor: product.priceMinor },
    };
  }
}

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttributesService } from '../attributes/attributes.service';
import { CategoriesService } from '../categories/categories.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/variant.dto';
import { Product } from './product.entity';
import { ProductVariant } from './product-variant.entity';

/** INR is the only currency (India-only store). */
const CURRENCY = 'inr';

/** A resolved attribute option on a variant (Color → Black). */
export interface VariantOption {
  typeId: string;
  type: string;
  slug: string;
  value: string;
  swatch: string | null;
}

export interface VariantView {
  id: string;
  sku: string | null;
  priceMinor: number;
  stock: number;
  images: string[];
  listedSeparately: boolean;
  isDefault: boolean;
  options: VariantOption[];
}

/** A flattened card for the product listing page (product or a listed variant). */
export interface ListingItem {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  priceMinor: number; // "from" price for a product with variants
  currency: string;
  inStock: boolean;
}

/** Full product for the detail page. */
export interface ProductDetail {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  imageUrl: string | null;
  categoryId: string | null;
  category: string | null;
  active: boolean;
  currency: string;
  basePriceMinor: number;
  baseStock: number;
  priceFromMinor: number;
  hasVariants: boolean;
  variants: VariantView[];
}

export interface CatalogQuery {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

/** A resolved cart/order line: product (+ optional variant) with live pricing. */
export interface PurchasableLine {
  productId: string;
  variantId: string | null;
  name: string;
  label: string | null; // variant options, e.g. "Black / Steel"
  unitAmountMinor: number;
  stock: number;
  available: boolean;
  imageUrl: string | null;
}

/** Product business logic: catalog reads + admin product/variant management. */
@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    private readonly categories: CategoriesService,
    private readonly attributes: AttributesService,
  ) {}

  /** How many products exist (used by the seeder to run only once). */
  count(): Promise<number> {
    return this.products.count();
  }

  // ---- Public catalog -------------------------------------------------------

  /** Listing page: products flattened with their separately-listed variants. */
  async findAll(q: CatalogQuery = {}): Promise<ListingItem[]> {
    const limit = Math.min(Math.max(q.limit ?? 50, 1), 100);
    const page = Math.max(q.page ?? 1, 1);

    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.variants', 'v')
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);
    if (!q.includeInactive) qb.andWhere('p.active = true');
    if (q.search) qb.andWhere('p.name ILIKE :s', { s: `%${q.search}%` });
    if (q.categoryId) qb.andWhere('p.categoryId = :c', { c: q.categoryId });

    const products = await qb.getMany();
    const lookup = await this.optionLookup();

    const items: ListingItem[] = [];
    for (const p of products) {
      const variants = p.variants ?? [];
      const priceFrom = variants.length
        ? Math.min(...variants.map((v) => v.priceMinor))
        : p.priceMinor;
      const inStock = variants.length
        ? variants.some((v) => v.stock > 0)
        : p.stock > 0;
      items.push({
        key: p.id,
        productId: p.id,
        variantId: null,
        name: p.name,
        slug: p.slug,
        imageUrl: p.imageUrl,
        categoryId: p.categoryId,
        priceMinor: priceFrom,
        currency: CURRENCY,
        inStock,
      });
      // Variants explicitly flagged to show as their own listing card.
      for (const v of variants.filter((x) => x.listedSeparately)) {
        const opts = this.resolveOptions(v.valueIds, lookup);
        items.push({
          key: v.id,
          productId: p.id,
          variantId: v.id,
          name: `${p.name} — ${opts.map((o) => o.value).join(' / ')}`,
          slug: p.slug,
          imageUrl: v.images[0] ?? p.imageUrl,
          categoryId: p.categoryId,
          priceMinor: v.priceMinor,
          currency: CURRENCY,
          inStock: v.stock > 0,
        });
      }
    }
    return items;
  }

  /** Detail page: resolve by id or slug, with variants + options. */
  async getDetail(idOrSlug: string): Promise<ProductDetail> {
    // Only match on id when it's actually a UUID, else Postgres rejects the cast.
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );
    const product = await this.products.findOne({
      where: isUuid ? { id: idOrSlug } : { slug: idOrSlug },
      relations: { variants: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const lookup = await this.optionLookup();
    const variants = (product.variants ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((v) => this.toVariantView(v, lookup));
    const priceFrom = variants.length
      ? Math.min(...variants.map((v) => v.priceMinor))
      : product.priceMinor;

    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      imageUrl: product.imageUrl,
      categoryId: product.categoryId,
      category: product.category,
      active: product.active,
      currency: CURRENCY,
      basePriceMinor: product.priceMinor,
      baseStock: product.stock,
      priceFromMinor: priceFrom,
      hasVariants: variants.length > 0,
      variants,
    };
  }

  /** Admin: all products (incl. inactive) with their variants, for management. */
  listAllAdmin(): Promise<Product[]> {
    return this.products.find({
      relations: { variants: true },
      order: { createdAt: 'DESC' },
    });
  }

  /** The raw product row (used by cart/checkout for name, price + stock). */
  findEntity(id: string): Promise<Product | null> {
    return this.products.findOne({ where: { id } });
  }

  /** The raw variant row (used by cart/checkout). */
  findVariant(id: string): Promise<ProductVariant | null> {
    return this.variants.findOne({ where: { id } });
  }

  /** How many variants a product has (0 = simple product). */
  variantCount(productId: string): Promise<number> {
    return this.variants.count({ where: { productId } });
  }

  /**
   * Resolve a cart/order line (product + optional variant) into the live
   * name/price/stock/label used for display and checkout. Returns null if the
   * product no longer exists.
   */
  async resolveLine(
    productId: string,
    variantId: string | null,
  ): Promise<PurchasableLine | null> {
    const product = await this.products.findOne({ where: { id: productId } });
    if (!product) return null;

    if (variantId) {
      const v = await this.variants.findOne({ where: { id: variantId } });
      if (!v || v.productId !== productId) {
        return {
          productId, variantId, name: product.name, label: null,
          unitAmountMinor: 0, stock: 0, available: false,
          imageUrl: product.imageUrl,
        };
      }
      const opts = this.resolveOptions(v.valueIds, await this.optionLookup());
      return {
        productId,
        variantId,
        name: product.name,
        label: opts.map((o) => o.value).join(' / ') || null,
        unitAmountMinor: v.priceMinor,
        stock: v.stock,
        available: product.active,
        imageUrl: v.images[0] ?? product.imageUrl,
      };
    }

    return {
      productId,
      variantId: null,
      name: product.name,
      label: null,
      unitAmountMinor: product.priceMinor,
      stock: product.stock,
      available: product.active,
      imageUrl: product.imageUrl,
    };
  }

  // ---- Stock (product-level; variant-level added with the cart refactor) ----

  async decrementStock(productId: string, qty: number): Promise<boolean> {
    const res = await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock - ${qty}` })
      .where('id = :id AND stock >= :qty', { id: productId, qty })
      .execute();
    return (res.affected ?? 0) > 0;
  }

  async incrementStock(productId: string, qty: number): Promise<void> {
    await this.products
      .createQueryBuilder()
      .update(Product)
      .set({ stock: () => `stock + ${qty}` })
      .where('id = :id', { id: productId })
      .execute();
  }

  /** Atomic variant stock decrement (guarded), for variant-based lines. */
  async decrementVariantStock(variantId: string, qty: number): Promise<boolean> {
    const res = await this.variants
      .createQueryBuilder()
      .update(ProductVariant)
      .set({ stock: () => `stock - ${qty}` })
      .where('id = :id AND stock >= :qty', { id: variantId, qty })
      .execute();
    return (res.affected ?? 0) > 0;
  }

  async incrementVariantStock(variantId: string, qty: number): Promise<void> {
    await this.variants
      .createQueryBuilder()
      .update(ProductVariant)
      .set({ stock: () => `stock + ${qty}` })
      .where('id = :id', { id: variantId })
      .execute();
  }

  /** Decrement the right stock for a line (variant if present, else product). */
  decrementLineStock(productId: string, variantId: string | null, qty: number): Promise<boolean> {
    return variantId
      ? this.decrementVariantStock(variantId, qty)
      : this.decrementStock(productId, qty);
  }

  /** Restore the right stock for a line. */
  incrementLineStock(productId: string, variantId: string | null, qty: number): Promise<void> {
    return variantId
      ? this.incrementVariantStock(variantId, qty)
      : this.incrementStock(productId, qty);
  }

  // ---- Admin: products ------------------------------------------------------

  async create(dto: CreateProductDto): Promise<Product> {
    if (dto.categoryId && !(await this.categories.exists(dto.categoryId))) {
      throw new BadRequestException('Category not found');
    }
    return this.products.save(this.products.create(dto));
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.mustFind(id);
    if (dto.categoryId && !(await this.categories.exists(dto.categoryId))) {
      throw new BadRequestException('Category not found');
    }
    Object.assign(product, dto);
    return this.products.save(product);
  }

  async remove(id: string): Promise<void> {
    const res = await this.products.delete(id); // variants cascade
    if (!res.affected) throw new NotFoundException('Product not found');
  }

  // ---- Admin: variants ------------------------------------------------------

  async addVariant(productId: string, dto: CreateVariantDto): Promise<ProductVariant> {
    await this.mustFind(productId);
    await this.assertValueIds(dto.valueIds);
    if (dto.isDefault) await this.clearDefault(productId);
    return this.variants.save(
      this.variants.create({
        productId,
        valueIds: dto.valueIds,
        priceMinor: dto.priceMinor,
        stock: dto.stock,
        sku: dto.sku ?? null,
        images: dto.images ?? [],
        listedSeparately: dto.listedSeparately ?? false,
        isDefault: dto.isDefault ?? false,
        sortOrder: dto.sortOrder ?? 0,
      }),
    );
  }

  async updateVariant(id: string, dto: UpdateVariantDto): Promise<ProductVariant> {
    const variant = await this.variants.findOne({ where: { id } });
    if (!variant) throw new NotFoundException('Variant not found');
    if (dto.valueIds) await this.assertValueIds(dto.valueIds);
    if (dto.isDefault) await this.clearDefault(variant.productId);
    Object.assign(variant, dto);
    return this.variants.save(variant);
  }

  async removeVariant(id: string): Promise<void> {
    const res = await this.variants.delete(id);
    if (!res.affected) throw new NotFoundException('Variant not found');
  }

  // ---- helpers --------------------------------------------------------------

  private async mustFind(id: string): Promise<Product> {
    const product = await this.products.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async clearDefault(productId: string): Promise<void> {
    await this.variants.update({ productId }, { isDefault: false });
  }

  private async assertValueIds(ids: string[]): Promise<void> {
    const found = await this.attributes.valuesByIds(ids);
    if (found.length !== new Set(ids).size) {
      throw new BadRequestException('One or more attribute values do not exist');
    }
  }

  /** valueId -> { type, slug, value, swatch } for resolving variant options. */
  private async optionLookup(): Promise<Map<string, VariantOption>> {
    const types = await this.attributes.listWithValues();
    const map = new Map<string, VariantOption>();
    for (const t of types) {
      for (const v of t.values) {
        map.set(v.id, {
          typeId: t.id,
          type: t.name,
          slug: t.slug,
          value: v.value,
          swatch: v.swatch,
        });
      }
    }
    return map;
  }

  private resolveOptions(
    valueIds: string[],
    lookup: Map<string, VariantOption>,
  ): VariantOption[] {
    return valueIds
      .map((id) => lookup.get(id))
      .filter((o): o is VariantOption => !!o);
  }

  private toVariantView(
    v: ProductVariant,
    lookup: Map<string, VariantOption>,
  ): VariantView {
    return {
      id: v.id,
      sku: v.sku,
      priceMinor: v.priceMinor,
      stock: v.stock,
      images: v.images ?? [],
      listedSeparately: v.listedSeparately,
      isDefault: v.isDefault,
      options: this.resolveOptions(v.valueIds, lookup),
    };
  }
}
